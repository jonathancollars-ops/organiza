/**
 * SecuritySanitizer.ts
 *
 * Centralized utility for HTML sanitization, control character stripping,
 * prompt injection delimiter wrapping, and API key validation.
 */

export class SecuritySanitizer {
  /**
   * Strips HTML tags, removes unprintable ASCII control characters,
   * normalizes whitespace, and trims the input.
   */
  static sanitizeText(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    return input
      // Remove dangerous tag blocks and their inner contents
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, ' ')
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, ' ')
      .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, ' ')
      // Block level tags become space to prevent word joining
      .replace(/<\/?(p|div|br|hr|h[1-6]|li|tr|td|blockquote|section|article)\b[^>]*>/gi, ' ')
      // Strip all remaining inline HTML tags
      .replace(/<[^>]+>/g, '')
      // Remove control characters (0x00-0x08, 0x0B-0x0C, 0x0E-0x1F, 0x7F)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      // Normalize multiple whitespace characters to a single space
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Robust HTML tag stripping and entity decoding for incoming external rich text.
   */
  static sanitizeHtml(html: string): string {
    if (!html || typeof html !== 'string') {
      return '';
    }

    let text = html
      // Strip dangerous blocks and their contents
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, ' ')
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, ' ')
      .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, ' ')
      // Block level tags become spaces
      .replace(/<\/?(p|div|br|hr|h[1-6]|li|tr|td|blockquote|section|article)\b[^>]*>/gi, ' ')
      // Strip all remaining inline tags
      .replace(/<[^>]+>/g, '')
      // Decode HTML entities
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&apos;/gi, "'")
      // Numeric decimal and hex entities
      .replace(/&#(\d+);/g, (_, dec) => {
        try {
          return String.fromCharCode(parseInt(dec, 10));
        } catch {
          return '';
        }
      })
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
        try {
          return String.fromCharCode(parseInt(hex, 16));
        } catch {
          return '';
        }
      })
      // Strip control characters
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      // Collapse whitespace
      .replace(/\s+/g, ' ')
      .trim();

    return text;
  }

  /**
   * Isolates untrusted external or user-supplied content inside XML-style delimiter tags,
   * neutralizing any attempt to escape or close the delimiter tag from within the content.
   */
  static wrapWithUntrustedDelimiter(content: string, tag: string = 'untrusted_content'): string {
    const safeTag = (tag || 'untrusted_content').replace(/[^a-zA-Z0-9_-]/g, '') || 'untrusted_content';
    const cleanContent = this.sanitizeHtml(content || '');

    // Neutralize any closing or opening tags that match the delimiter
    const tagNeutralizer = new RegExp(`</?\\s*${safeTag}\\s*[^>]*>`, 'gi');
    const neutralized = cleanContent.replace(tagNeutralizer, '');

    return `<${safeTag}>\n${neutralized}\n</${safeTag}>`;
  }

  /**
   * Validates API key formatting for supported AI providers (Gemini, OpenAI).
   */
  static validateApiKey(key: string, provider: 'gemini' | 'openai'): boolean {
    if (!key || typeof key !== 'string') {
      return false;
    }

    const trimmed = key.trim();
    if (!trimmed) {
      return false;
    }

    if (provider === 'gemini') {
      // Google Gemini API keys typically start with AIzaSy and are ~39 characters long
      const geminiRegex = /^AIzaSy[A-Za-z0-9_-]{30,45}$/;
      return geminiRegex.test(trimmed);
    }

    if (provider === 'openai') {
      // OpenAI API keys typically start with sk- or sk-proj- or sk-svc- and are >= 20 characters
      const openAiRegex = /^sk-(?:proj-|svc-)?[A-Za-z0-9_-]{20,}$/;
      return openAiRegex.test(trimmed);
    }

    return false;
  }
}
