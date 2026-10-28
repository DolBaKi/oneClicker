// power.js
// - 지금 전원에 연결돼 있는지 확인한다
// - 지원하지 않는 브라우저가 많아서, 못 읽으면 조용히 넘어간다 (경고를 띄우지 않는다)

/*
  왜 보는가:
  배터리로 돌 때 노트북은 성능을 의도적으로 제한한다. 그 상태로 재면
  멀쩡한 기기도 느리게 나오고, 스로틀링이 걸린 것처럼 보인다.
  즉 "노후라서 느린 것"과 "절전이라 느린 것"이 섞여버린다.

  navigator.getBattery()는 사파리·파이어폭스에는 없고, 크롬도 보안 맥락에 따라 막는다.
  그래서 "확인할 수 없음"이 정상 결과 중 하나다. 없으면 안내를 생략한다.
*/
export async function readPowerState() {
  if (!navigator.getBattery) return { known: false };
  try {
    const battery = await navigator.getBattery();
    return {
      known: true,
      charging: battery.charging,
      level: Math.round(battery.level * 100),
    };
  } catch {
    return { known: false };
  }
}

// 배터리로 돌고 있을 때만 안내 문구를 돌려준다. 그 외에는 null
export async function powerWarning() {
  const power = await readPowerState();
  if (!power.known || power.charging) return null;
  return `배터리로 사용 중입니다(${power.level}%). `
    + '전원을 연결하면 성능 제한이 풀려 더 정확하게 측정됩니다';
}
