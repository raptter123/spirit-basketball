// 시험들이 같이 쓰는 것 — 사이트 주소, 받은 파일을 둘 폴더, 사이트를 띄우는 작은 서버.
//
// 시험은 원래 한 사람의 작업 폴더 경로와 8911 포트를 박아 두고 있었다. 그러면 그
// 폴더가 사라지는 순간 시험도 같이 못 쓰게 되고, 다른 컴퓨터(GitHub Actions 포함)
// 에서는 처음부터 안 돈다. 여기 한 곳에서 환경변수로 받는다.
//
//   CHECK_URL  시험이 열 사이트 주소. 없으면 http://127.0.0.1:8911
//   CHECK_OUT  받은 엑셀 · 이미지 · 스크린샷을 둘 곳. 없으면 <임시폴더>/spirit-checks
//
// 서버는 따로 설치할 것 없이 node 만으로 띄운다. 사이트는 빌드 도구가 없는 정적 파일
// 묶음이라 파일을 그대로 내주기만 하면 된다.
import fs from "fs";
import os from "os";
import path from "path";
import http from "http";
import { fileURLToPath } from "url";

export const URL = process.env.CHECK_URL || "http://127.0.0.1:8911";
const 뿌리 = process.env.CHECK_OUT || path.join(os.tmpdir(), "spirit-checks");

/** 받은 파일을 둘 폴더. 없으면 만든다. */
export function 폴더(이름 = "") {
  const d = path.join(뿌리, 이름);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

/** 저장소 맨 위 폴더 (tools/checks 의 두 칸 위). */
export const 저장소 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const 종류 = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".woff2": "font/woff2", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json",
};

/** 저장소를 그대로 내주는 서버를 빈 포트에 띄운다. { url, 닫기 } 를 돌려준다.
 *  주소 뒤의 ?v=… 는 배포 때 붙는 캐시 표시라 무시한다. 저장소 밖으로 나가는
 *  경로(../)는 거절한다. */
export function 서버띄우기(루트 = 저장소) {
  const 서버 = http.createServer((req, res) => {
    let 경로 = decodeURIComponent(req.url.split("?")[0].split("#")[0]);
    if (경로.endsWith("/")) 경로 += "index.html";
    const 파일 = path.join(루트, 경로);
    if (!파일.startsWith(루트)) { res.writeHead(403); res.end(); return; }
    fs.readFile(파일, (err, buf) => {
      if (err) { res.writeHead(404); res.end("없음"); return; }
      res.writeHead(200, {
        "Content-Type": 종류[path.extname(파일).toLowerCase()] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(buf);
    });
  });
  return new Promise((resolve) => {
    서버.listen(0, "127.0.0.1", () => {
      const { port } = 서버.address();
      resolve({ url: `http://127.0.0.1:${port}`, 닫기: () => new Promise((r) => 서버.close(r)) });
    });
  });
}
