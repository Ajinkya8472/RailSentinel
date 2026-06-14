/**
 * src/utils/hindiVoice.js
 *
 * Purpose:
 * Provides utility functions to support Indian Railways Public Address (PA)
 * broadcast notifications. Handles Hindi bilingual content validation, payload
 * text extraction, language metadata mapping, and safe Web Speech API synthesis
 * preparation, queue management, and real-time audio playback control.
 *
 * Dependencies:
 * - `src/types/notification.js` (for constants and Enums)
 *
 * Exports:
 * - isHindiRequired: Checks if a channel mandates Hindi content.
 * - validatePaBroadcastContent: Validates presence of PA scripts.
 * - getPaBroadcastPayload: Extracts formatted text for announcements.
 * - getLanguageMetadata: Maps internal locales to BCP-47 and native names.
 * - isSpeechSupported: Structural check for browser audio synthesis engines.
 * - speak: High-comprehension vocal synthesis dispatcher with zero-overlap safety.
 * - stopSpeaking: Instantly terminates active client PA audio channels.
 * - createSpeechSynthesisUtterance: Safely constructs a Web Speech utterance.
 */

import { NOTIF_CHANNEL, NOTIF_LOCALE } from '../types/notification.js'; 

// ---------------------------------------------------------------------------
// Validation & Extraction
// ---------------------------------------------------------------------------

/**
 * Checks if a given notification channel requires Hindi bilingual content.
 *
 * @param {string} channel - The delivery channel (e.g., 'pa', 'sms').
 * @returns {boolean} True if Hindi is required.
 */
export function isHindiRequired(channel) {
  return NOTIF_CHANNEL.requiresHindi?.includes(channel) || channel === 'pa';
}

/**
 * Validates that a notification has the necessary Hindi content if it is marked
 * as a PA broadcast.
 *
 * @param {Object} notification - The canonical Notification record.
 * @returns {Object} Validation result { valid: boolean, errors: string[] }
 */
export function validatePaBroadcastContent(notification) {
  const errors = [];
  if (!notification || typeof notification !== 'object') {
    return { valid: false, errors: ['Invalid or missing notification object'] };
  }

  if (notification.isPaBroadcast) {
    if (!notification.paBroadcastTextHi || notification.paBroadcastTextHi.trim() === '') {
      errors.push('Missing Hindi PA script (paBroadcastTextHi) required for PA broadcasts.');
    }
    if (!notification.paBroadcastText || notification.paBroadcastText.trim() === '') {
      errors.push('Missing English PA script fallback (paBroadcastText).');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Extracts the appropriate payload text for a PA broadcast based on locale preference.
 * Defaults to bilingual (Hindi followed by English) if both are present and no
 * specific override is provided.
 *
 * @param {Object} notification - The canonical Notification record.
 * @param {string} [preferredLocale] - Optional locale override ('en' or 'hi').
 * @returns {string|null} The text to be broadcast, or null if invalid.
 */
export function getPaBroadcastPayload(notification, preferredLocale) {
  if (!notification || !notification.isPaBroadcast) return null;

  const enText = (notification.paBroadcastText || '').trim();
  const hiText = (notification.paBroadcastTextHi || '').trim();

  if (preferredLocale === NOTIF_LOCALE.HI && hiText) return hiText;
  if (preferredLocale === NOTIF_LOCALE.EN && enText) return enText;

  // Indian Railways standard bilingual format: Hindi followed by English
  if (hiText && enText) {
    return `${hiText} ... ${enText}`;
  }

  return hiText || enText || null;
}

// ---------------------------------------------------------------------------
// Language Display Metadata Mapping
// ---------------------------------------------------------------------------

/**
 * Returns BCP-47 language codes and native display names for supported locales.
 *
 * @param {string} locale - The internal NOTIF_LOCALE code.
 * @returns {Object} Metadata including { code, name, nativeName }.
 */
export function getLanguageMetadata(locale) {
  switch (locale) {
    case NOTIF_LOCALE.HI:
      return { code: 'hi-IN', name: 'Hindi', nativeName: 'हिन्दी' };
    case NOTIF_LOCALE.EN_HI:
      return { code: 'hi-IN', name: 'Bilingual (EN/HI)', nativeName: 'English / हिन्दी' };
    case NOTIF_LOCALE.BN:
      return { code: 'bn-IN', name: 'Bengali', nativeName: 'বাংলা' };
    case NOTIF_LOCALE.TA:
      return { code: 'ta-IN', name: 'Tamil', nativeName: 'தமிழ்' };
    case NOTIF_LOCALE.TE:
      return { code: 'te-IN', name: 'Telugu', nativeName: 'తెలుగు' };
    case NOTIF_LOCALE.KN:
      return { code: 'kn-IN', name: 'Kannada', nativeName: 'ಕನ್ನಡ' };
    case NOTIF_LOCALE.MR:
      return { code: 'mr-IN', name: 'Marathi', nativeName: 'मराठी' };
    case NOTIF_LOCALE.GU:
      return { code: 'gu-IN', name: 'Gujarati', nativeName: 'ગુજરાતી' };
    case NOTIF_LOCALE.PA_LANG:
      return { code: 'pa-IN', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ' };
    case NOTIF_LOCALE.EN:
    default:
      return { code: 'en-IN', name: 'English (India)', nativeName: 'English' };
  }
}

// ---------------------------------------------------------------------------
// Native Speech Synthesis Engine Core Layer
// ---------------------------------------------------------------------------

/**
 * Checks if the browser runtime environment supports the W3C Web Speech API.
 * Securely blocks Node.js/SSR build compilation crashes.
 *
 * @returns {boolean} True if window.speechSynthesis is accessible.
 */
export function isSpeechSupported() {
  return typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined';
}

/**
 * Scans runtime audio registers to load matching regional voice variants.
 *
 * @param {string} langCode - BCP-47 target language identifier parameter.
 * @returns {SpeechSynthesisVoice|null} Resolved native device voice profile.
 */
const lookupSystemVoice = (langCode) => {
  if (!isSpeechSupported()) return null;
  const voices = window.speechSynthesis.getVoices();
  
  // Find precise language code track match
  let matchedVoice = voices.find(v => v.lang === langCode);
  
  // Secondary fallback lookup strategy (prefix check e.g., 'hi')
  if (!matchedVoice) {
    const prefix = langCode.split('-')[0];
    matchedVoice = voices.find(v => v.lang.startsWith(prefix));
  }
  return matchedVoice || null;
};

/**
 * Speaks a technical PA telemetry payload immediately using browser audio mixers.
 * Enforces zero-overlap constraints by stopping pre-existing active telemetry playbacks.
 *
 * @param {string} text - Clean string text target segment ready to synthesize.
 * @param {Object} [options] - Output hardware channel configuration flags.
 * @param {string} [options.langCode='hi-IN'] - Target BCP-47 language token configuration.
 * @param {number} [options.rate=0.85] - Speed multiplier. Slightly lowered to preserve field radio clarity.
 * @param {number} [options.pitch=1.0] - Pitch parameter value scales (0.0 to 2.0).
 * @param {number} [options.volume=1.0] - Amplitude output level metrics (0.0 to 1.0).
 * @param {Function} [options.onStart] - Event listener callback fired as audio opens.
 * @param {Function} [options.onEnd] - Event listener callback fired as speech runs to completion.
 * @param {Function} [options.onError] - Fallback intercept listener catch mechanism.
 */
export function speak(text, options = {}) {
  const {
    langCode = 'hi-IN',
    rate = 0.85,
    pitch = 1.0,
    volume = 1.0,
    onStart = null,
    onEnd = null,
    onError = null
  } = options;

  if (!isSpeechSupported()) {
    if (typeof onError === 'function') {
      onError(new Error("Web Speech API driver layer not supported in this client window runtime."));
    }
    return;
  }

  // ⚡ CRITICAL ENFORCEMENT: Terminate unresolved audio loops to prevent PA signal congestion.
  stopSpeaking();

  const utterance = createSpeechSynthesisUtterance(text, langCode, rate, pitch);
  if (!utterance) return;

  utterance.volume = volume;

  // Track dynamic interface updates
  if (typeof onStart === 'function') utterance.onstart = onStart;
  if (typeof onEnd === 'function') utterance.onend = onEnd;
  if (typeof onError === 'function') utterance.onerror = onError;

  // Queue allocation deployment
  window.speechSynthesis.speak(utterance);
}

/**
 * Instantly shuts down the hardware synthesis line and purges stuck PA audio buffers.
 */
export function stopSpeaking() {
  if (!isSpeechSupported()) return;
  window.speechSynthesis.cancel();
}

/**
 * Creates a SpeechSynthesisUtterance object safely.
 * Returns null if the Web Speech API is not available in the current environment
 * (e.g., SSR / Node.js) to avoid direct browser side-effects on import.
 *
 * @param {string} text - The text to synthesize.
 * @param {string} [langCode='hi-IN'] - The BCP-47 language code (defaults to Hindi).
 * @param {number} [rate=0.85] - Speaking rate (slightly slower for PA clarity).
 * @param {number} [pitch=1.0] - Speaking pitch.
 * @returns {SpeechSynthesisUtterance|null} The utterance ready to be passed to window.speechSynthesis.speak().
 */
export function createSpeechSynthesisUtterance(text, langCode = 'hi-IN', rate = 0.85, pitch = 1.0) {
  if (!isSpeechSupported()) {
    return null;
  }

  if (!text || text.trim() === '') return null;

  const utterance = new window.SpeechSynthesisUtterance(text);
  utterance.lang = langCode;
  utterance.rate = rate;
  utterance.pitch = pitch;

  // Intercept voice reference to wire specialized language packets
  const systemVoice = lookupSystemVoice(langCode);
  if (systemVoice) {
    utterance.voice = systemVoice;
  }

  return utterance;
}

// Warm up system audio driver hooks inside Chromium/WebKit runtimes asynchronously
if (isSpeechSupported() && typeof window.speechSynthesis.onvoiceschanged !== 'undefined') {
  window.speechSynthesis.onvoiceschanged = () => lookupSystemVoice('hi-IN');
}