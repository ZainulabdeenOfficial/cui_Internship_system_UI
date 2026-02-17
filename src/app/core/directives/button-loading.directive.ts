import { Directive, ElementRef, Input, OnChanges, Renderer2, SimpleChanges } from '@angular/core';

/**
 * Button Loading Directive
 * Automatically manages button loading state with spinner
 * 
 * Usage:
 * <button [appButtonLoading]="isLoading">Submit</button>
 */
@Directive({
  selector: '[appButtonLoading]',
  standalone: true
})
export class ButtonLoadingDirective implements OnChanges {
  @Input() appButtonLoading = false;
  @Input() loadingText = 'Loading...';
  
  private originalContent: string | null = null;
  private spinner: HTMLElement | null = null;

  constructor(
    private el: ElementRef<HTMLButtonElement>,
    private renderer: Renderer2
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['appButtonLoading']) {
      if (this.appButtonLoading) {
        this.showLoading();
      } else {
        this.hideLoading();
      }
    }
  }

  private showLoading(): void {
    const button = this.el.nativeElement;
    
    // Store original content
    if (!this.originalContent) {
      this.originalContent = button.innerHTML;
    }

    // Disable button
    this.renderer.setAttribute(button, 'disabled', 'true');
    this.renderer.addClass(button, 'btn-loading');

    // Create spinner
    this.spinner = this.renderer.createElement('span');
    this.renderer.addClass(this.spinner, 'spinner-border');
    this.renderer.addClass(this.spinner, 'spinner-border-sm');
    this.renderer.addClass(this.spinner, 'me-2');
    this.renderer.setAttribute(this.spinner, 'role', 'status');
    this.renderer.setAttribute(this.spinner, 'aria-hidden', 'true');

    // Update button content
    this.renderer.setProperty(button, 'innerHTML', '');
    this.renderer.appendChild(button, this.spinner);
    
    const textNode = this.renderer.createText(this.loadingText);
    this.renderer.appendChild(button, textNode);
  }

  private hideLoading(): void {
    const button = this.el.nativeElement;

    // Remove disabled attribute
    this.renderer.removeAttribute(button, 'disabled');
    this.renderer.removeClass(button, 'btn-loading');

    // Restore original content
    if (this.originalContent) {
      this.renderer.setProperty(button, 'innerHTML', this.originalContent);
    }

    this.spinner = null;
  }
}
