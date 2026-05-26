-- v2.1.29: 채용/강의 공고에 외부 폼 링크(구글폼/네이버폼/카카오톡 등) 추가
ALTER TABLE ic_recruitments ADD COLUMN form_url TEXT;
ALTER TABLE ic_lectures     ADD COLUMN form_url TEXT;
