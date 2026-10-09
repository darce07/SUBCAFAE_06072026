import { useEffect, useState } from "react";
import { listarUsuariosApoyo, type UsuarioApoyo } from "../services/escaneos.service";

export function useUsuariosApoyo() {
  const [usuarios, setUsuarios] = useState<UsuarioApoyo[]>([]);
  useEffect(() => {
    let active = true;
    void listarUsuariosApoyo().then((rows) => { if (active) setUsuarios(rows); }, () => undefined);
    return () => { active = false; };
  }, []);
  return usuarios;
}
