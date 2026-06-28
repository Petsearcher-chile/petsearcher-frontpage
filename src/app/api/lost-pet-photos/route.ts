export async function POST(request: Request) {
  const formData = await request.formData();
  const uploadedFiles = formData.getAll("photos").filter(
    (entry): entry is File => entry instanceof File,
  );

  if (uploadedFiles.length === 0) {
    return Response.json({ message: "No se enviaron fotos." }, { status: 400 });
  }

  if (uploadedFiles.length > 10) {
    return Response.json(
      { message: "Puedes subir hasta 10 fotos." },
      { status: 400 },
    );
  }

  const files = await Promise.all(
    uploadedFiles.map(async (file) => ({
      name: file.name,
      size: file.size,
      type: file.type,
      bytes: (await file.arrayBuffer()).byteLength,
    })),
  );

  return Response.json({
    ok: true,
    count: uploadedFiles.length,
    files,
  });
}
