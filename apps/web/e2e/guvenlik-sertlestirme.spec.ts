import { expect, test } from "@playwright/test";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001";

async function login(request: import("@playwright/test").APIRequestContext) {
  const response = await request.post(`${apiBaseUrl}/auth/login`, {
    data: {
      username: "admin",
      password: "admin123"
    }
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()).data.accessToken as string;
}

test("a foreign site cannot reach the local system through its own address", async ({ request }) => {
  const foreign = await request.post(`${apiBaseUrl}/auth/login`, {
    headers: { Host: "kotu-site.example:3001" },
    data: { username: "admin", password: "1234" }
  });
  expect(foreign.status()).toBe(403);

  const local = await request.get(`${apiBaseUrl}/health`, { headers: { Host: "localhost:3001" } });
  expect(local.status()).toBe(200);
});

test("responses carry the protective headers", async ({ request }) => {
  const response = await request.get(`${apiBaseUrl}/health`);
  const headers = response.headers();
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["content-security-policy"]).toContain("sandbox");
});

test("a program renamed as a document is refused", async ({ request }) => {
  const token = await login(request);
  const authorization = { Authorization: `Bearer ${token}` };
  const folders = await (await request.get(`${apiBaseUrl}/folders/root`, { headers: authorization })).json();
  const departments = await (await request.get(`${apiBaseUrl}/departments`, { headers: authorization })).json();
  const upload = (name: string, mimeType: string, buffer: Buffer) =>
    request.post(`${apiBaseUrl}/documents/upload`, {
      headers: authorization,
      multipart: {
        file: { name, mimeType, buffer },
        name: `Tur denemesi ${Date.now()}`,
        folderId: folders.data[0].id,
        documentType: "OTHER",
        responsibleDepartmentId: departments.data[0].id
      }
    });

  const program = Buffer.from("MZ\x90\x00program");
  const wordType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  expect((await upload("rapor.pdf", "application/pdf", program)).status()).toBe(400);
  expect((await upload("rapor.docx", wordType, program)).status()).toBe(400);
  expect((await upload("resim.png", "image/png", program)).status()).toBe(400);
  // The name and the reported type must agree as well.
  expect((await upload("sayfa.pdf", "text/plain", Buffer.from("%PDF-1.4\n"))).status()).toBe(400);
  expect((await upload("sayfa.html", "text/plain", Buffer.from("<script>"))).status()).toBe(400);

  const accepted = await upload("gercek.pdf", "application/pdf", Buffer.from("%PDF-1.4\n"));
  expect(accepted.ok()).toBeTruthy();
  const { data } = await accepted.json();
  await request.delete(`${apiBaseUrl}/documents/${data.id}`, { headers: authorization });
  await request.delete(`${apiBaseUrl}/trash/documents/${data.id}`, { headers: authorization });
});
