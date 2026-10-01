import { WebContainer, type WebContainerProcess } from "@webcontainer/api";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { CURL_SHIM } from "./curl-shim";

const host = document.documentElement.dataset.siteHost!;
const path = document.documentElement.dataset.path!;
const status = document.getElementById("status")!;
const fallback = document.getElementById("fallback")!;
const container = document.getElementById("terminal")!;

const BOOT_TIMEOUT_MS = 20_000;

function setStatus(message: string) {
  status.textContent = message;
}

async function run(wc: WebContainer, command: string, args: string[]): Promise<{ exit: number; output: string }> {
  try {
    const proc = await wc.spawn(command, args);
    let output = "";
    proc.output.pipeTo(new WritableStream({ write: (chunk) => void (output += chunk) }));
    return { exit: await proc.exit, output };
  } catch (e) {
    return { exit: -1, output: String(e) };
  }
}

// 試作用の診断。WebContainer 内の curl と通信の可否を確かめる（要件書 10章）
async function diagnose(wc: WebContainer): Promise<{ nativeCurl: boolean; lines: string[] }> {
  const curl = await run(wc, "curl", ["--version"]);
  const probe = await run(wc, "node", [
    "-e",
    `fetch(${JSON.stringify(location.origin + "/")}, { headers: { accept: "text/plain" } })
      .then((r) => console.log("status " + r.status))
      .catch((e) => { console.log("error " + e.message); process.exit(1); })`,
  ]);
  const nativeCurl = curl.exit === 0;
  return {
    nativeCurl,
    lines: [
      `curl --version : exit ${curl.exit} ${curl.output.split("\n")[0].trim()}`,
      `node fetch ${location.origin}/ : exit ${probe.exit} ${probe.output.trim()}`,
      `curl コマンド : ${nativeCurl ? "WebContainer 標準" : "自前（bin/curl）"}`,
    ],
  };
}

async function main() {
  if (!crossOriginIsolated) {
    setStatus("この環境ではターミナルを起動できないため、テキストで表示しています。");
    return;
  }

  setStatus("ターミナルを起動しています…");
  let wc: WebContainer;
  try {
    // 配信元に届かない場合 boot() は失敗も完了もしないため、時間で打ち切る
    wc = await Promise.race([
      WebContainer.boot(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("boot timeout")), BOOT_TIMEOUT_MS)),
    ]);
  } catch (e) {
    console.error(e);
    setStatus("ターミナルを起動できなかったため、テキストで表示しています。");
    return;
  }

  const { nativeCurl, lines } = await diagnose(wc);
  // ローカル開発では mewton.jp ではなくこのページの配信元を叩く必要があるため、自前の curl を使う
  const useShim = !nativeCurl || location.host !== host;
  if (useShim) {
    await wc.mount({ bin: { directory: { curl: { file: { contents: CURL_SHIM } } } } });
  }

  const term = new Terminal({ convertEol: true, cursorBlink: true, fontSize: 14 });
  const fit = new FitAddon();
  term.loadAddon(fit);
  container.hidden = false;
  fallback.hidden = true;
  setStatus("");
  term.open(container);
  fit.fit();

  term.writeln(`\x1b[2m[diag] ${lines.join("\n[diag] ")}\x1b[0m`);

  let shell: WebContainerProcess;
  try {
    shell = await wc.spawn("jsh", {
      terminal: { cols: term.cols, rows: term.rows },
      env: { MEWTON_HOST: host, MEWTON_ORIGIN: location.origin },
    });
  } catch (e) {
    console.error(e);
    container.hidden = true;
    fallback.hidden = false;
    setStatus("ターミナルを起動できなかったため、テキストで表示しています。");
    return;
  }
  shell.output.pipeTo(new WritableStream({ write: (chunk) => term.write(chunk) }));
  const input = shell.input.getWriter();
  term.onData((data) => input.write(data));
  window.addEventListener("resize", () => {
    fit.fit();
    shell.resize({ cols: term.cols, rows: term.rows });
  });

  // 開いた URL と同じ内容を表示する（要件書 7.3）
  if (useShim) await input.write(`export PATH="${wc.workdir}/bin:$PATH"\n`);
  await input.write(`curl ${host}${path === "/" ? "" : path}\n`);
  term.focus();
}

main();
