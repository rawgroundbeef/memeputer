import chalk from "chalk";

export function formatSuccess(message: string): string {
  return chalk.green("✅ " + message);
}

export function formatError(message: string): string {
  return chalk.red("❌ " + message);
}

export function formatInfo(message: string): string {
  return chalk.blue("ℹ️  " + message);
}

export function formatWarning(message: string): string {
  return chalk.yellow("⚠️  " + message);
}

export function formatPrice(usdc: number): string {
  return chalk.cyan(`$${usdc.toFixed(2)} USDC`);
}

export function formatAgent(name: string): string {
  return chalk.magenta(`🤖 ${name}`);
}

export function formatPublicKey(key: string): string {
  if (key.length <= 12) return chalk.gray(key);
  return chalk.gray(`${key.slice(0, 4)}...${key.slice(-4)}`);
}

export function formatUsdc(amount: number): string {
  let decimals = 2;
  if (amount < 0.01 && amount > 0) {
    decimals = 4;
  }
  return chalk.cyan(`${amount.toFixed(decimals)} USDC`);
}

export function formatUrl(url: string): string {
  return chalk.underline.blue(url);
}

export function formatSignature(signature: string): string {
  return chalk.gray(`${signature.slice(0, 8)}...${signature.slice(-8)}`);
}

export function printBox(title: string, content: string[]): void {
  const width = Math.max(
    title.length,
    ...content.map((line) => stripAnsi(line).length),
  );
  const border = "─".repeat(width + 4);

  console.log(`┌${border}┐`);
  console.log(
    `│  ${chalk.bold(title)}${" ".repeat(width - title.length + 2)}│`,
  );
  console.log(`├${border}┤`);

  for (const line of content) {
    const stripped = stripAnsi(line);
    const padding = " ".repeat(width - stripped.length);
    console.log(`│  ${line}${padding}  │`);
  }

  console.log(`└${border}┘`);
}

// Simple ANSI strip for box formatting
function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "");
}

export function formatTable(headers: string[], rows: string[][]): void {
  // Calculate column widths
  const widths = headers.map((header, i) => {
    const rowWidths = rows.map((row) => stripAnsi(row[i] || "").length);
    return Math.max(header.length, ...rowWidths);
  });

  // Print header
  const headerRow = headers
    .map((header, i) => header.padEnd(widths[i]))
    .join("  ");
  console.log(chalk.bold(headerRow));
  console.log("─".repeat(widths.reduce((a, b) => a + b + 2, 0)));

  // Print rows
  for (const row of rows) {
    const formattedRow = row
      .map((cell, i) => {
        const stripped = stripAnsi(cell);
        const padding = widths[i] - stripped.length;
        return cell + " ".repeat(padding);
      })
      .join("  ");
    console.log(formattedRow);
  }
}
