const fs = require("fs");
const path = require("path");

const appJsonPath = path.resolve(__dirname, "..", "app.json");
const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf8"));
const dryRun = process.argv.includes("--dry-run");

const iosConfig = appJson.expo && appJson.expo.ios;

if (!iosConfig) {
  throw new Error("Missing expo.ios config in app.json");
}

const currentBuildNumber = Number.parseInt(iosConfig.buildNumber, 10);

if (!Number.isFinite(currentBuildNumber)) {
  throw new Error(
    `expo.ios.buildNumber must be a number-like string. Received: ${iosConfig.buildNumber}`
  );
}

const nextBuildNumber = String(currentBuildNumber + 1);
iosConfig.buildNumber = nextBuildNumber;

if (!dryRun) {
  fs.writeFileSync(appJsonPath, `${JSON.stringify(appJson, null, 2)}\n`);
}

const action = dryRun ? "Would bump" : "Bumped";
console.log(`${action} iOS buildNumber: ${currentBuildNumber} -> ${nextBuildNumber}`);
