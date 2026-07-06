import { useState } from "react";
import { uploadDocumentoFile } from "../services/storage.service";

export function useUploadDocumento() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const upload = async (
    file: File,
    metadata: {
      userId: string;
      idempotencyKey: string;
      categoria: string;
      anio: number;
      mes: number;
      dia: number;
    },
  ) => {
    setUploading(true);
    setProgress(15);
    setError(null);
    try {
      const interval = window.setInterval(() => setProgress((value) => Math.min(value + 12, 88)), 180);
      const result = await uploadDocumentoFile(file, metadata);
      window.clearInterval(interval);
      setProgress(100);
      return result;
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "No se pudo subir el archivo.");
      throw uploadError;
    } finally {
      setUploading(false);
    }
  };

  return { upload, uploading, progress, error };
}
