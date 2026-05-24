-- v2.1.24: 좌측버튼 리스 + 렌트카 두 카드 → 「리스/렌트카」 단일 카드로 통합
-- v2.1.22~v2.1.23 사이 짧은 기간에 두 라벨로 들어온 클릭들을 새 라벨로 합산 후 옛 행 삭제

INSERT INTO ic_card_clicks_daily (date, menu, card, clicks)
  SELECT date, '좌측버튼', '리스/렌트카', SUM(clicks)
    FROM ic_card_clicks_daily
   WHERE menu='좌측버튼' AND card IN ('리스','렌트카')
   GROUP BY date
  ON CONFLICT (date, menu, card)
  DO UPDATE SET clicks = ic_card_clicks_daily.clicks + excluded.clicks;

DELETE FROM ic_card_clicks_daily
 WHERE menu='좌측버튼' AND card IN ('리스','렌트카');
