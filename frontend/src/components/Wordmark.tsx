import {APP_NAME, BRAND_LINE} from '../lib/brand';

/** "Eu" in a lighter weight, "Kardia" bold, with the line "A good heart" set beside it in a serif italic. */
export function Wordmark() {
  const split = 2;
  return (
    <span className="wm">
      <span className="wm-name" aria-label={APP_NAME}>{APP_NAME.slice(0, split)}<b>{APP_NAME.slice(split)}</b></span>
      <span className="wm-tag">{BRAND_LINE}</span>
    </span>
  );
}
