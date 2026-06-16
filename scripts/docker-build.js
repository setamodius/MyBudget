const { execSync } = require("child_process")
const fs = require("fs")
const path = require("path")
const { version } = require("../package.json")

const repoRoot = path.resolve(__dirname, "..")

execSync(`docker build -t mybudget:${version} .`, { stdio: "inherit", cwd: repoRoot })

const composePath = path.join(repoRoot, "docker-compose.yml")
const compose = fs.readFileSync(composePath, "utf-8")
const updated = compose.replace(/image: mybudget:.+/, `image: mybudget:${version}`)
fs.writeFileSync(composePath, updated)

console.log(`\nBuilt image mybudget:${version} and updated docker-compose.yml`)
