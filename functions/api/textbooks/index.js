import { listHandler, postHandler, corsPreflight } from '../../_lib/crud.js';
export const onRequestOptions = () => corsPreflight();
export const onRequestGet  = listHandler('ic_textbooks', []);
export const onRequestPost = postHandler('ic_textbooks', ['title','description','file_url','file_type']);
