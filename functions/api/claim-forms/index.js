import { listHandler, postHandler, corsPreflight } from '../../_lib/crud.js';
export const onRequestOptions = () => corsPreflight();
export const onRequestGet  = listHandler('ic_claim_forms', ['company']);
export const onRequestPost = postHandler('ic_claim_forms', ['company','title','file_url','file_type']);
