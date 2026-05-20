import { getOneHandler, deleteHandler, patchHandler, corsPreflight } from '../../_lib/crud.js';
export const onRequestOptions = () => corsPreflight();
export const onRequestGet    = getOneHandler('ic_newsletters');
export const onRequestDelete = deleteHandler('ic_newsletters');
export const onRequestPatch  = patchHandler('ic_newsletters', ['company','title','file_url','file_type']);
