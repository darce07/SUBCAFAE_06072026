-- El bucket 'documentos' tenia file_size_limit en 50MB (001_sigdaf_complete.sql)
-- pero el cliente (storage.service.ts) valida 20MB antes de subir. Un usuario
-- que llame directo a la API de Storage (saltandose la validacion del cliente)
-- podia subir hasta 50MB. Se alinea el limite del bucket al mismo tope que ya
-- aplica el cliente, para que la validacion no dependa solo del frontend.
update storage.buckets
set file_size_limit = 20971520 -- 20 * 1024 * 1024
where id = 'documentos';
