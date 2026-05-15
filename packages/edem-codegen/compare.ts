import { $ } from "bun"

const ORIGINAL = import.meta.dir + "/../../apps/exodus"
const GENERATED = import.meta.dir + "/../../apps/exodus-generated"

const file = process.argv[2]

if (file) {
  await $`diff -u --label "a/${file}" --label "b/${file}" ${ORIGINAL}/${file} ${GENERATED}/${file}`.nothrow()
} else {
  const tracked = await $`git -C ${ORIGINAL} ls-files`.quiet()
  const files = tracked.stdout.toString().trim().split("\n").filter(Boolean)

  const changed: string[] = []
  for (const f of files) {
    const result = await $`diff -q ${ORIGINAL}/${f} ${GENERATED}/${f}`.nothrow().quiet()
    if (result.exitCode !== 0) changed.push(f)
  }

  console.log(changed.join("\n") || "no changes")
}
