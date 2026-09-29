// 얻은 것 목록(원신처럼 왼쪽에 한 줄씩 미끄러져 들어왔다가 사라진다): ⭐ 별조각 · € · 🔹 연마석 · 경험치 · 장비
export class Feed {
  private readonly el: HTMLElement;
  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'feed';
    document.body.appendChild(this.el);
  }
  push(icon: string, text: string, tone: '' | 'gold' | 'blue' | 'purple' = '') {
    const row = document.createElement('div');
    row.className = `it ${tone}`;
    row.innerHTML = '<i></i><span></span>';
    row.querySelector('i')!.textContent = icon;
    row.querySelector('span')!.textContent = text;
    this.el.appendChild(row);
    while (this.el.children.length > 5) this.el.firstElementChild!.remove();
    setTimeout(() => row.classList.add('out'), 3200);
    setTimeout(() => row.remove(), 3700);
  }
}
