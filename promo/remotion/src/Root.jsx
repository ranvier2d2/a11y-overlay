import React from 'react';
import {Composition} from 'remotion';
import {PromoComposition} from './components/PromoComposition.jsx';
import {cuts, FPS, PROMO_HEIGHT, PROMO_WIDTH} from './data/cuts.js';

export const RemotionRoot = () => {
  return (
    <>
      {Object.values(cuts).map((cut) => (
        <Composition
          key={cut.compositionId}
          id={cut.compositionId}
          component={PromoComposition}
          durationInFrames={cut.durationInFrames}
          fps={FPS}
          width={PROMO_WIDTH}
          height={PROMO_HEIGHT}
          defaultProps={{cutId: cut.id}}
        />
      ))}
    </>
  );
};
