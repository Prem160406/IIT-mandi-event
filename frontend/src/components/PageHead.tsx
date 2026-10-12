import type {ReactNode} from 'react';
import {Ecg} from './Heartbeat';

export function PageHead({title, children}: {title: string; children?: ReactNode}) {
  return (
    <div className="pagehead">
      <Ecg className="ph-ecg" />
      <h2>{title}</h2>
      <div className="row">{children}</div>
    </div>
  );
}
