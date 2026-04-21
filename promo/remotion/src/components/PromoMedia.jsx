import React from 'react';
import {Html5Video, OffthreadVideo, getRemotionEnvironment} from 'remotion';

export const PromoMedia = ({src, style}) => {
  const environment = getRemotionEnvironment();
  const mediaStyle = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    ...style,
  };

  if (environment.isRendering) {
    return <OffthreadVideo muted src={src} style={mediaStyle} />;
  }

  return <Html5Video muted playsInline src={src} style={mediaStyle} />;
};
