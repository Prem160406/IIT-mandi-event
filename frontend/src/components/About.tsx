import {DISCLAIMER} from '../lib/anatomy';

export function About() {
  return (
    <div className="about">
      <p><b>What this is.</b> A student prototype for the Multimodal AI Hackathon 2026, Track A. Patient measurements go in, four models predict overall coronary artery disease and narrowing in the LAD, LCX and RCA, and the 3D heart colours each artery from its predicted probability.</p>
      <p><b>Data.</b> Extension of the Z-Alizadeh Sani dataset (UCI Machine Learning Repository, 303 patients). The outcome columns LAD, LCX, RCA, Cath and CAD are never used as inputs.</p>
      <p><b>Models.</b> One logistic regression per target with imputing and scaling inside the pipeline. The explanations are exact log-odds contributions of each feature.</p>
      <p><b>3D model.</b> A stylised, schematic heart built procedurally for this project. The arteries show where each vessel runs, not a patient's real anatomy.</p>
      <p><b>Limits.</b> The risk bands (below 35% low, above 65% high) are display bands, not clinically validated thresholds. The models are trained on 303 patients and have not been tested on any other population.</p>
      <p className="disc">{DISCLAIMER}</p>
    </div>
  );
}
