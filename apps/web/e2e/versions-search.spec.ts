import { expect, test, type APIRequestContext } from "@playwright/test";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001";

type Headers = { Authorization: string };

async function login(request: APIRequestContext, username: string, password: string): Promise<Headers> {
  const response = await request.post(`${apiBaseUrl}/auth/login`, { data: { username, password } });
  expect(response.ok()).toBe(true);

  return { Authorization: `Bearer ${((await response.json()) as { data: { accessToken: string } }).data.accessToken}` };
}

function buildPdf(text: string) {
  const stream = `BT /F1 18 Tf 60 760 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  ];
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];

  objects.forEach((object, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((offset) => {
    body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

  return Buffer.from(body);
}

async function setup(request: APIRequestContext) {
  const admin = await login(request, "admin", "admin123");
  const viewer = await login(request, "viewer", "viewer123");
  const me = await (await request.get(`${apiBaseUrl}/auth/me`, { headers: viewer })).json();
  const departments = await (await request.get(`${apiBaseUrl}/departments`, { headers: admin })).json();
  const folders = await (await request.get(`${apiBaseUrl}/folders/root`, { headers: admin })).json();

  return {
    admin,
    viewer,
    folderId: folders.data[0].id as string,
    otherDepartmentId: departments.data.find((item: { id: string }) => item.id !== me.data.department?.id).id as string
  };
}

async function upload(
  request: APIRequestContext,
  headers: Headers,
  fields: { name: string; folderId: string; responsibleDepartmentId: string; accessLevel?: string },
  file: { name: string; mimeType: string; buffer: Buffer }
) {
  const response = await request.post(`${apiBaseUrl}/documents/upload`, {
    headers,
    multipart: { file, documentType: "OTHER", ...fields }
  });
  expect(response.ok()).toBe(true);

  return ((await response.json()) as { data: { id: string } }).data.id;
}

async function search(request: APIRequestContext, headers: Headers, q: string) {
  const response = await request.get(`${apiBaseUrl}/documents`, { headers, params: { q, limit: "100" } });

  return ((await response.json()) as { data: Array<{ id: string }> }).data.map((item) => item.id);
}

async function remove(request: APIRequestContext, headers: Headers, id: string) {
  await request.delete(`${apiBaseUrl}/documents/${id}`, { headers });
  await request.delete(`${apiBaseUrl}/trash/documents/${id}`, { headers });
}

test("replacing a file keeps the old version downloadable", async ({ request }) => {
  const ctx = await setup(request);
  const id = await upload(
    request,
    ctx.admin,
    { name: `Sürümlü Belge ${Date.now()}`, folderId: ctx.folderId, responsibleDepartmentId: ctx.otherDepartmentId },
    { name: "surum.txt", mimeType: "text/plain", buffer: Buffer.from("birinci sürüm") }
  );

  try {
    expect((await request.post(`${apiBaseUrl}/documents/${id}/new-version`, {
      headers: ctx.viewer,
      multipart: { file: { name: "x.txt", mimeType: "text/plain", buffer: Buffer.from("x") } }
    })).status()).toBe(403);

    const replaced = await request.post(`${apiBaseUrl}/documents/${id}/new-version`, {
      headers: ctx.admin,
      multipart: { file: { name: "surum-2.txt", mimeType: "text/plain", buffer: Buffer.from("ikinci sürüm") } }
    });
    expect(replaced.ok()).toBe(true);

    const versions = ((await (await request.get(`${apiBaseUrl}/documents/${id}/versions`, { headers: ctx.viewer })).json()) as {
      data: Array<{ id: string; versionNo: string; isActive: boolean }>;
    }).data;
    expect(versions.map((item) => item.versionNo)).toEqual(["2", "1"]);
    expect(versions[0].isActive).toBe(true);

    const oldFile = await request.get(`${apiBaseUrl}/documents/${id}/versions/${versions[1].id}/download`, { headers: ctx.viewer });
    expect(await oldFile.text()).toBe("birinci sürüm");
    const current = await request.get(`${apiBaseUrl}/documents/${id}/download`, { headers: ctx.viewer });
    expect(await current.text()).toBe("ikinci sürüm");
  } finally {
    await remove(request, ctx.admin, id);
  }
});

test("a record without a file can get its first file later", async ({ request }) => {
  const ctx = await setup(request);
  const created = await request.post(`${apiBaseUrl}/documents`, {
    headers: ctx.admin,
    data: {
      name: `Dosyasız Kayıt ${Date.now()}`,
      folderId: ctx.folderId,
      documentType: "REPORT",
      sizeBytes: 1,
      responsibleDepartmentId: ctx.otherDepartmentId
    }
  });
  const id = ((await created.json()) as { data: { id: string } }).data.id;

  try {
    const before = await (await request.get(`${apiBaseUrl}/documents/${id}/versions`, { headers: ctx.admin })).json();
    expect(before.data).toEqual([]);

    expect((await request.post(`${apiBaseUrl}/documents/${id}/new-version`, {
      headers: ctx.admin,
      multipart: { file: { name: "ilk.txt", mimeType: "text/plain", buffer: Buffer.from("ilk dosya") } }
    })).ok()).toBe(true);

    const after = await (await request.get(`${apiBaseUrl}/documents/${id}/versions`, { headers: ctx.admin })).json();
    expect(after.data.map((item: { versionNo: string }) => item.versionNo)).toEqual(["1"]);
    expect(await (await request.get(`${apiBaseUrl}/documents/${id}/download`, { headers: ctx.admin })).text()).toBe("ilk dosya");
  } finally {
    await remove(request, ctx.admin, id);
  }
});

test("search finds words inside documents, in any Turkish casing, and respects access", async ({ request }) => {
  const ctx = await setup(request);
  const stamp = Date.now();
  const openWord = `ACIKKELIME${stamp}`;
  const secretWord = `GIZLIKELIME${stamp}`;
  const pdfWord = `PDFKELIME${stamp}`;

  const textId = await upload(
    request,
    ctx.admin,
    { name: `Arama Metin ${stamp}`, folderId: ctx.folderId, responsibleDepartmentId: ctx.otherDepartmentId },
    { name: "metin.txt", mimeType: "text/plain", buffer: Buffer.from(`İÇ TETKİK ${openWord} ŞİKAYET FORMU`) }
  );
  const secretId = await upload(
    request,
    ctx.admin,
    { name: `Arama Gizli ${stamp}`, folderId: ctx.folderId, responsibleDepartmentId: ctx.otherDepartmentId, accessLevel: "CONFIDENTIAL" },
    { name: "gizli.txt", mimeType: "text/plain", buffer: Buffer.from(`personel ${secretWord}`) }
  );
  const pdfId = await upload(
    request,
    ctx.admin,
    { name: `Arama Pdf ${stamp}`, folderId: ctx.folderId, responsibleDepartmentId: ctx.otherDepartmentId },
    { name: "belge.pdf", mimeType: "application/pdf", buffer: buildPdf(`KALITE ${pdfWord}`) }
  );

  try {
    await expect.poll(() => search(request, ctx.viewer, `iç tetkik ${openWord}`), { timeout: 15_000 }).toContain(textId);
    await expect.poll(() => search(request, ctx.viewer, pdfWord.toLowerCase()), { timeout: 15_000 }).toContain(pdfId);
    expect(await search(request, ctx.viewer, `şikayet formu`)).toContain(textId);

    // A confidential document's content is found only by people allowed to see it.
    await expect.poll(() => search(request, ctx.admin, secretWord.toLowerCase()), { timeout: 15_000 }).toContain(secretId);
    expect(await search(request, ctx.viewer, secretWord.toLowerCase())).not.toContain(secretId);

    // After replacing the file only the new content is searched.
    const newWord = `YENIKELIME${stamp}`;
    expect((await request.post(`${apiBaseUrl}/documents/${textId}/new-version`, {
      headers: ctx.admin,
      multipart: { file: { name: "metin-2.txt", mimeType: "text/plain", buffer: Buffer.from(newWord) } }
    })).ok()).toBe(true);
    await expect.poll(() => search(request, ctx.viewer, newWord.toLowerCase()), { timeout: 15_000 }).toContain(textId);
    expect(await search(request, ctx.viewer, openWord.toLowerCase())).not.toContain(textId);
  } finally {
    await remove(request, ctx.admin, textId);
    await remove(request, ctx.admin, secretId);
    await remove(request, ctx.admin, pdfId);
  }
});
