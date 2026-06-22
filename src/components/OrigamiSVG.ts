import type { FoldLine, Question } from '../data/questionBank';

export interface FoldState {
  foldedLines: Set<string>;
  currentStep: number;
}

export class OrigamiSVG {
  private svg: SVGSVGElement;
  private paperSize: number;
  private foldLines: FoldLine[];
  private onFold: (lineId: string) => void;
  private onUnfold: (lineId: string) => void;
  private transformGroup: SVGGElement;
  private paperGroup: SVGGElement;
  private foldStates: Map<string, boolean> = new Map();

  private scale: number = 1;
  private translateX: number = 0;
  private translateY: number = 0;
  private minScale: number = 0.5;
  private maxScale: number = 4;
  private isDragging: boolean = false;
  private dragStartX: number = 0;
  private dragStartY: number = 0;
  private dragStartTranslateX: number = 0;
  private dragStartTranslateY: number = 0;

  constructor(
    container: HTMLElement,
    question: Question,
    onFold: (lineId: string) => void,
    onUnfold: (lineId: string) => void
  ) {
    this.paperSize = question.paperSize;
    this.foldLines = question.foldLines;
    this.onFold = onFold;
    this.onUnfold = onUnfold;

    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('viewBox', `0 0 ${this.paperSize} ${this.paperSize + 50}`);
    this.svg.setAttribute('class', 'origami-svg');

    this.transformGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.transformGroup.setAttribute('class', 'transform-group');
    this.svg.appendChild(this.transformGroup);

    this.paperGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.paperGroup.setAttribute('class', 'paper-group');
    this.transformGroup.appendChild(this.paperGroup);

    this.render();
    this.bindEvents();
    container.appendChild(this.svg);
  }

  private bindEvents(): void {
    this.svg.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
    this.svg.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.svg.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.svg.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    this.svg.addEventListener('mouseleave', (e) => this.handleMouseUp(e));
  }

  private handleWheel(e: WheelEvent): void {
    e.preventDefault();

    const rect = this.svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const svgPoint = this.clientToSVG(mouseX, mouseY);

    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(this.minScale, Math.min(this.maxScale, this.scale * delta));

    const scaleFactor = newScale / this.scale;

    this.translateX = svgPoint.x - (svgPoint.x - this.translateX) * scaleFactor;
    this.translateY = svgPoint.y - (svgPoint.y - this.translateY) * scaleFactor;
    this.scale = newScale;

    this.updateTransform();
  }

  private handleMouseDown(e: MouseEvent): void {
    if (e.button !== 0) return;

    const target = e.target as Element;
    if (target.classList.contains('fold-line-hit')) return;

    this.isDragging = true;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    this.dragStartTranslateX = this.translateX;
    this.dragStartTranslateY = this.translateY;
    this.svg.style.cursor = 'grabbing';
  }

  private handleMouseMove(e: MouseEvent): void {
    if (!this.isDragging) return;

    const dx = e.clientX - this.dragStartX;
    const dy = e.clientY - this.dragStartY;

    const rect = this.svg.getBoundingClientRect();
    const svgWidth = this.paperSize;
    const svgHeight = this.paperSize + 50;
    const scaleX = svgWidth / rect.width;
    const scaleY = svgHeight / rect.height;

    this.translateX = this.dragStartTranslateX + dx * scaleX;
    this.translateY = this.dragStartTranslateY + dy * scaleY;

    this.updateTransform();
  }

  private handleMouseUp(_e: MouseEvent): void {
    this.isDragging = false;
    this.svg.style.cursor = 'default';
  }

  private clientToSVG(clientX: number, clientY: number): { x: number; y: number } {
    const pt = this.svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const svgP = pt.matrixTransform(this.svg.getScreenCTM()?.inverse());
    return { x: svgP.x, y: svgP.y };
  }

  private updateTransform(): void {
    this.transformGroup.setAttribute(
      'transform',
      `translate(${this.translateX} ${this.translateY}) scale(${this.scale})`
    );
    this.transformGroup.style.transformOrigin = '0 0';
  }

  zoomIn(): void {
    this.scale = Math.min(this.maxScale, this.scale * 1.2);
    this.updateTransform();
  }

  zoomOut(): void {
    this.scale = Math.max(this.minScale, this.scale / 1.2);
    this.updateTransform();
  }

  resetView(): void {
    this.scale = 1;
    this.translateX = 0;
    this.translateY = 0;
    this.updateTransform();
  }

  getScale(): number {
    return this.scale;
  }

  private render(): void {
    this.paperGroup.innerHTML = '';

    const paper = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    paper.setAttribute('x', '0');
    paper.setAttribute('y', '0');
    paper.setAttribute('width', String(this.paperSize));
    paper.setAttribute('height', String(this.paperSize));
    paper.setAttribute('class', 'paper');
    this.paperGroup.appendChild(paper);

    const sortedLines = [...this.foldLines].sort((a, b) => a.order - b.order);

    sortedLines.forEach((line) => {
      const lineGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      lineGroup.setAttribute('class', `fold-line ${line.type}`);
      lineGroup.setAttribute('data-line-id', line.id);

      const svgLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      svgLine.setAttribute('x1', String(line.x1));
      svgLine.setAttribute('y1', String(line.y1));
      svgLine.setAttribute('x2', String(line.x2));
      svgLine.setAttribute('y2', String(line.y2));
      svgLine.setAttribute('class', 'fold-line-path');
      lineGroup.appendChild(svgLine);

      const hitArea = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      hitArea.setAttribute('x1', String(line.x1));
      hitArea.setAttribute('y1', String(line.y1));
      hitArea.setAttribute('x2', String(line.x2));
      hitArea.setAttribute('y2', String(line.y2));
      hitArea.setAttribute('class', 'fold-line-hit');
      hitArea.style.cursor = 'pointer';
      hitArea.addEventListener('click', () => this.toggleFold(line.id));
      lineGroup.appendChild(hitArea);

      const midX = (line.x1 + line.x2) / 2;
      const midY = (line.y1 + line.y2) / 2;

      const orderBadge = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      orderBadge.setAttribute('class', 'order-badge');
      orderBadge.setAttribute('transform', `translate(${midX}, ${midY})`);

      const badgeBg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      badgeBg.setAttribute('r', '12');
      badgeBg.setAttribute('class', 'order-badge-bg');
      orderBadge.appendChild(badgeBg);

      const badgeText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      badgeText.setAttribute('text-anchor', 'middle');
      badgeText.setAttribute('dominant-baseline', 'central');
      badgeText.setAttribute('class', 'order-badge-text');
      badgeText.textContent = String(line.order);
      orderBadge.appendChild(badgeText);

      lineGroup.appendChild(orderBadge);
      this.paperGroup.appendChild(lineGroup);

      this.foldStates.set(line.id, false);
    });

    const legend = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    legend.setAttribute('class', 'legend');
    legend.setAttribute('transform', `translate(10, ${this.paperSize + 20})`);

    const valleyLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    valleyLine.setAttribute('x1', '0');
    valleyLine.setAttribute('y1', '0');
    valleyLine.setAttribute('x2', '30');
    valleyLine.setAttribute('y2', '0');
    valleyLine.setAttribute('class', 'legend-line valley');
    legend.appendChild(valleyLine);

    const valleyText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    valleyText.setAttribute('x', '35');
    valleyText.setAttribute('y', '4');
    valleyText.setAttribute('class', 'legend-text');
    valleyText.textContent = '谷折';
    legend.appendChild(valleyText);

    const mountainLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    mountainLine.setAttribute('x1', '80');
    mountainLine.setAttribute('y', '0');
    mountainLine.setAttribute('x2', '110');
    mountainLine.setAttribute('y2', '0');
    mountainLine.setAttribute('class', 'legend-line mountain');
    legend.appendChild(mountainLine);

    const mountainText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    mountainText.setAttribute('x', '115');
    mountainText.setAttribute('y', '4');
    mountainText.setAttribute('class', 'legend-text');
    mountainText.textContent = '山折';
    legend.appendChild(mountainText);

    this.svg.setAttribute('viewBox', `0 0 ${this.paperSize} ${this.paperSize + 50}`);
    this.svg.setAttribute('height', String(this.paperSize + 50));
    this.paperGroup.appendChild(legend);
  }

  private toggleFold(lineId: string): void {
    const isFolded = this.foldStates.get(lineId);
    if (isFolded) {
      this.unfoldLine(lineId);
    } else {
      this.foldLine(lineId);
    }
  }

  foldLine(lineId: string, notify = true): void {
    if (!this.foldStates.has(lineId)) return;

    this.foldStates.set(lineId, true);
    this.updateLineVisual(lineId, true);
    if (notify) {
      this.onFold(lineId);
    }
    this.updatePaperTransform();
  }

  unfoldLine(lineId: string, notify = true): void {
    if (!this.foldStates.has(lineId)) return;

    this.foldStates.set(lineId, false);
    this.updateLineVisual(lineId, false);
    if (notify) {
      this.onUnfold(lineId);
    }
    this.updatePaperTransform();
  }

  private updateLineVisual(lineId: string, folded: boolean): void {
    const lineGroup = this.paperGroup.querySelector(`[data-line-id="${lineId}"]`);
    if (lineGroup) {
      if (folded) {
        lineGroup.classList.add('folded');
      } else {
        lineGroup.classList.remove('folded');
      }
    }
  }

  private updatePaperTransform(): void {
    const paperRect = this.paperGroup.querySelector('.paper');
    if (paperRect) {
      const foldedCount = this.getFoldedCount();
      if (foldedCount === 0) {
        paperRect.removeAttribute('transform');
        paperRect.removeAttribute('transform-origin');
        return;
      }

      const scale = Math.max(0.68, 1 - foldedCount * 0.08);
      const offset = (this.paperSize * (1 - scale)) / 2;
      paperRect.setAttribute('transform-origin', `${this.paperSize / 2}px ${this.paperSize / 2}px`);
      paperRect.setAttribute('transform', `translate(${offset} ${offset}) scale(${scale})`);
    }
  }

  isFolded(lineId: string): boolean {
    return this.foldStates.get(lineId) || false;
  }

  getFoldedCount(): number {
    let count = 0;
    this.foldStates.forEach((folded) => {
      if (folded) count++;
    });
    return count;
  }

  reset(): void {
    this.foldLines.forEach(line => {
      this.foldStates.set(line.id, false);
      this.updateLineVisual(line.id, false);
    });
    const paperRect = this.paperGroup.querySelector('.paper');
    if (paperRect) {
      paperRect.removeAttribute('transform');
      paperRect.removeAttribute('transform-origin');
    }
    this.resetView();
  }

  destroy(): void {
    this.svg.remove();
  }
}
