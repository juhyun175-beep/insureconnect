import { listHandler, postHandler, corsPreflight } from '../../_lib/crud.js';
export const onRequestOptions = () => corsPreflight();
export const onRequestGet  = listHandler('ic_knowledge_posts', []);
export const onRequestPost = postHandler('ic_knowledge_posts', ['title','content','image_url','tags']);
