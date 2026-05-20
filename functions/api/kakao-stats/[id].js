import { deleteHandler, corsPreflight } from '../../_lib/crud.js';
export const onRequestOptions = () => corsPreflight();
export const onRequestDelete = deleteHandler('ic_kakao_stats');
