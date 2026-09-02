export interface RenderOptions { url?: string; html?: string; width?: number; height?: number; device_scale_factor?: number; wait_until?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit'; wait_for?: string; delay?: number; timeout?: number; css?: string; hide?: string; dark_mode?: boolean; block_ads?: boolean; user_agent?: string; locale?: string; timezone?: string; [key: string]: unknown }
export interface PdfOptions extends RenderOptions { format?: 'A0' | 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'A6' | 'Letter' | 'Legal' | 'Tabloid' | 'Ledger'; landscape?: boolean; margin?: string; print_background?: boolean; pdf_scale?: number; page_ranges?: string; header_template?: string; footer_template?: string; prefer_css_page_size?: boolean; media?: 'print' | 'screen' }
export interface ScreenshotOptions extends RenderOptions { format?: 'png' | 'jpeg' | 'webp'; quality?: number; full_page?: boolean; selector?: string; clip?: string; transparent?: boolean }
export interface Usage { plan: string; used: number; limit: number; period: string }
export class RenderKitError extends Error { status: number; code: string; readonly isQuotaExceeded: boolean; readonly isRateLimited: boolean }
export class RenderKit {
  constructor(apiKey: string, options?: { baseUrl?: string; timeoutMs?: number; fetch?: typeof fetch });
  pdf(options: PdfOptions): Promise<Buffer>;
  screenshot(options: ScreenshotOptions): Promise<Buffer>;
  usage(): Promise<Usage>;
}
