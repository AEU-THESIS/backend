const fs = require("fs");

const commitMsgFile = process.argv[2];
if (!commitMsgFile) {
  console.error("Error: No commit message file provided.");
  process.exit(1);
}

let commitMsg;
try {
  commitMsg = fs.readFileSync(commitMsgFile, "utf8");
} catch (err) {
  console.error(
    `Error: Could not read commit message file at ${commitMsgFile}:`,
    err.message,
  );
  process.exit(1);
}

// Regex for Jira ticket ID (e.g., ABC-123 or [ABC-123])
const jiraTicketRegex = /[A-Z]+-[0-9]+/;

if (!jiraTicketRegex.test(commitMsg)) {
  let ticketId = "";
  let fdIn, fdOut;

  // List of potential devices to try for interactive input/output
  const devices =
    process.platform === "win32"
      ? ["\\\\.\\CON", "CONIN$", "CON", "/dev/tty"]
      : ["/dev/tty", "/dev/stdin"];

  for (const device of devices) {
    try {
      fdIn = fs.openSync(device, "r");
      // For Windows devices like CONIN$, derive CONOUT$ correctly.
      const outDevice = device.includes("IN$")
        ? device.replace("IN$", "OUT$")
        : device;

      try {
        fdOut = fs.openSync(outDevice, "w");
      } catch (outErr) {
        fs.closeSync(fdIn);
        throw outErr;
      }

      if (fdIn && fdOut) break;
    } catch (e) {
      // Continue to next device
    }
  }

  if (fdIn && fdOut) {
    try {
      fs.writeSync(
        fdOut,
        "\x1b[33m[Jira Check] Jira ticket ID missing!\x1b[0m\n",
      );
      fs.writeSync(fdOut, "Enter Ticket ID (e.g. PROJ-123): ");

      const buffer = Buffer.alloc(1024);
      const bytesRead = fs.readSync(fdIn, buffer, 0, 1024);

      fs.closeSync(fdIn);
      fs.closeSync(fdOut);

      ticketId = buffer.toString("utf8", 0, bytesRead).trim().toUpperCase();
    } catch (err) {
      // Fallback below
    }
  }

  if (!ticketId) {
    console.error(
      "\x1b[31mError: This terminal does not support interactive prompts during Git hooks.\x1b[0m",
    );
    console.log("\x1b[36mHow to fix:\x1b[0m");
    console.log("Include the Jira ticket ID directly in your command:");
    console.log('   git commit -m "feat: [PROJ-123] your message"\n');
    process.exit(1);
  }

  if (jiraTicketRegex.test(ticketId)) {
    const cleanId = ticketId.replace(/[\[\]]/g, "");
    let newMsg;
    const conventionalMatch = commitMsg.match(/^(\w+(?:\([\w-]+\))?:\s*)(.*)/s);

    if (conventionalMatch) {
      newMsg = `${conventionalMatch[1]}[${cleanId}] ${conventionalMatch[2]}`;
    } else {
      newMsg = `[${cleanId}] ${commitMsg}`;
    }

    fs.writeFileSync(commitMsgFile, newMsg);
    console.log(
      `\x1b[32mSuccess: Jira ID [${cleanId}] added to commit message.\x1b[0m`,
    );
    process.exit(0);
  } else {
    console.error(
      `\x1b[31mError: "${ticketId}" is not a valid Jira ticket ID format (e.g., PROJ-123).\x1b[0m`,
    );
    process.exit(1);
  }
} else {
  process.exit(0);
}
