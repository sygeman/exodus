import { describe, it, expect, beforeEach } from "bun:test";
import { Evento } from "./evento";
import type { EventoHandler, EventoHandlerContext } from "./types";

describe("Evento", () => {
  let evento: Evento<"test">;

  beforeEach(() => {
    evento = new Evento("test");
  });

  const emit = (name: string, payload?: unknown) => {
    (evento as any).emit(name, payload);
  };

  describe("on", () => {
    it("should subscribe to exact event", () => {
      const handler = ({ name }: EventoHandlerContext<"test">) => {
        expect(name).toBe("user:login");
      };
      evento.on("user:login", handler as EventoHandler);
      emit("user:login");
    });

    it("should call handler with context", () => {
      let receivedContext: EventoHandlerContext<"test"> | null = null;
      const handler = (ctx: EventoHandlerContext<"test">) => {
        receivedContext = ctx;
      };
      evento.on("user:login", handler as EventoHandler);
      emit("user:login", { userId: 123 });

      expect(receivedContext).not.toBeNull();
      expect(receivedContext!.name).toBe("user:login");
      expect(receivedContext!.payload).toEqual({ userId: 123 });
      expect(receivedContext!.segments).toEqual(["user", "login"]);
      expect(receivedContext!.meta.environment).toBe("test");
    });

    it("should support multiple handlers for same event", () => {
      let count = 0;
      evento.on("user:login", () => count++);
      evento.on("user:login", () => count++);
      emit("user:login");
      expect(count).toBe(2);
    });

    it("should support wildcard patterns", () => {
      let called = false;
      evento.on("user:*", () => {
        called = true;
      });
      emit("user:login");
      expect(called).toBe(true);
    });

    it("should return unsubscribe function", () => {
      let count = 0;
      const unsubscribe = evento.on("user:login", () => count++);

      emit("user:login");
      expect(count).toBe(1);

      unsubscribe();
      emit("user:login");
      expect(count).toBe(1);
    });
  });

  describe("once", () => {
    it("should call handler only once", () => {
      let count = 0;
      evento.once("user:login", () => count++);

      emit("user:login");
      expect(count).toBe(1);

      emit("user:login");
      expect(count).toBe(1);
    });

    it("should work with wildcards", () => {
      let count = 0;
      evento.once("user:*", () => count++);

      emit("user:login");
      expect(count).toBe(1);

      emit("user:logout");
      expect(count).toBe(1);
    });

    it("should return unsubscribe function", () => {
      let count = 0;
      const unsubscribe = evento.once("user:login", () => count++);

      unsubscribe();
      emit("user:login");
      expect(count).toBe(0);
    });
  });

  describe("off", () => {
    it("should unsubscribe handler from exact event", () => {
      let count = 0;
      const handler = () => count++;

      evento.on("user:login", handler);
      emit("user:login");
      expect(count).toBe(1);

      evento.off(handler);
      emit("user:login");
      expect(count).toBe(1);
    });

    it("should unsubscribe handler from wildcard", () => {
      let count = 0;
      const handler = () => count++;

      evento.on("user:*", handler);
      emit("user:login");
      expect(count).toBe(1);

      evento.off(handler);
      emit("user:logout");
      expect(count).toBe(1);
    });

    it("should unsubscribe handler from multiple subscriptions", () => {
      let count = 0;
      const handler = () => count++;

      evento.on("user:login", handler);
      evento.on("user:*", handler);
      emit("user:login");
      expect(count).toBe(2);

      evento.off(handler);
      emit("user:login");
      expect(count).toBe(2);
    });
  });

  describe("offAll", () => {
    it("should remove all handlers for exact event", () => {
      let count = 0;
      evento.on("user:login", () => count++);
      evento.on("user:login", () => count++);

      evento.offAll("user:login");
      emit("user:login");
      expect(count).toBe(0);
    });

    it("should remove all handlers for wildcard pattern", () => {
      let count = 0;
      evento.on("user:*", () => count++);
      evento.on("user:*", () => count++);

      evento.offAll("user:*");
      emit("user:login");
      expect(count).toBe(0);
    });

    it("should remove all handlers when called without args", () => {
      let count = 0;
      evento.on("user:login", () => count++);
      evento.on("user:*", () => count++);

      evento.offAll();
      emit("user:login");
      expect(count).toBe(0);
    });
  });

  describe("emit", () => {
    it("should call matching handlers", () => {
      let loginCalled = false;
      let logoutCalled = false;

      evento.on("user:login", () => (loginCalled = true));
      evento.on("user:logout", () => (logoutCalled = true));

      emit("user:login");
      expect(loginCalled).toBe(true);
      expect(logoutCalled).toBe(false);
    });

    it("should pass payload to handlers", () => {
      let receivedPayload: unknown;
      evento.on("user:login", ({ payload }) => {
        receivedPayload = payload;
      });

      emit("user:login", { userId: 42 });
      expect(receivedPayload).toEqual({ userId: 42 });
    });

    it("should call wildcard handlers", () => {
      let exactCalled = false;
      let wildcardCalled = false;

      evento.on("user:login", () => (exactCalled = true));
      evento.on("user:*", () => (wildcardCalled = true));

      emit("user:login");
      expect(exactCalled).toBe(true);
      expect(wildcardCalled).toBe(true);
    });

    it("should call ** handlers for all events", () => {
      let count = 0;
      evento.on("**", () => count++);

      emit("user:login");
      emit("user:logout");
      emit("settings:update");
      expect(count).toBe(3);
    });
  });

  describe("wildcard patterns", () => {
    it("user:* should match user:login but not user:profile:update", () => {
      let count = 0;
      evento.on("user:*", () => count++);

      emit("user:login");
      expect(count).toBe(1);

      emit("user:profile:update");
      expect(count).toBe(1);
    });

    it("user:** should match any user events", () => {
      let count = 0;
      evento.on("user:**", () => count++);

      emit("user:login");
      emit("user:profile:update");
      emit("user:settings:theme:change");
      expect(count).toBe(3);
    });

    it("*:update should match any update event", () => {
      let count = 0;
      evento.on("*:update", () => count++);

      emit("user:update");
      emit("settings:update");
      emit("user:profile:update");
      expect(count).toBe(2);
    });

    it("**:*:error should match errors at any depth", () => {
      let count = 0;
      evento.on("**:*:error", () => count++);

      emit("api:error");
      emit("api:user:error");
      emit("api:v1:user:error");
      expect(count).toBe(1);
    });
  });
});
