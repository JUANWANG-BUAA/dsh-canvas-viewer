import fs from "node:fs";
const [file, startS, endS, blockFile] = process.argv.slice(2);
const start = Number(startS);
const end = Number(endS);
const lines = fs.readFileSync(file, "utf8").split("\n");
const block = fs.readFileSync(blockFile, "utf8").replace(/\n$/, "");
if (start < 1 || end < start - 1 || end > lines.length) {
  console.error("bad range", { start, end, total: lines.length });
  process.exit(1);
}
const next = lines.slice(0, start - 1).concat(block.split("\n"), lines.slice(end));
fs.writeFileSync(file, next.join("\n") + "\n", "utf8");
console.log("spliced " + file + " " + start + ".." + end + ": " + lines.length + " -> " + next.length);
