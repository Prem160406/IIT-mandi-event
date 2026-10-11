import {DISCLAIMER} from '../lib/anatomy';

export function DisclaimerBanner() {
  return (
    <div className="banner" role="note">
      <span className="tag">Notice</span>
      <span>{DISCLAIMER}</span>
    </div>
  );
}
