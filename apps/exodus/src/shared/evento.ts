type EventoEvent = (name: string, payload: unknown) => void;

export class Evento {
  private events: { [key: string]: EventoEvent[] } = {};
  private anys: EventoEvent[] = [];

  on(name: string, event: EventoEvent) {
    if (!this.events[name]) {
      this.events[name] = [];
    }
    this.events[name].push(event);
  }

  any(event: EventoEvent) {
    this.anys.push(event);
  }

  emit(name: string, payload: unknown) {
    this.anys.forEach((event) => event(name, payload));
  }
}
