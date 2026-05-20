import { getOneHandler, deleteHandler, patchHandler, corsPreflight } from '../../_lib/crud.js';
export const onRequestOptions = () => corsPreflight();
export const onRequestGet    = getOneHandler('ic_claim_forms');
export const onRequestDelete = deleteHandler('ic_claim_forms');
export const onRequestPatch  = patchHandler('ic_claim_forms', ['company','title','file_url','file_type']);
