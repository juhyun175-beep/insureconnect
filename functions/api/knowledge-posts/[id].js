import { getOneHandler, deleteHandler, patchHandler, corsPreflight } from '../../_lib/crud.js';
export const onRequestOptions = () => corsPreflight();
export const onRequestGet    = getOneHandler('ic_knowledge_posts');
export const onRequestDelete = deleteHandler('ic_knowledge_posts');
export const onRequestPatch  = patchHandler('ic_knowledge_posts', ['title','content','image_url','tags']);
