import React from 'react';
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {cuts} from '../data/cuts.js';
import {theme} from '../theme.js';
import {PromoMedia} from './PromoMedia.jsx';

const clamp = {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
};

const getSceneOffsets = (scenes) => {
  let offset = 0;

  return scenes.map((scene) => {
    const current = offset;
    offset += scene.frames;
    return current;
  });
};

const BackgroundLayer = ({cut}) => {
  return (
    <AbsoluteFill style={{backgroundColor: theme.colors.bg}}>
      <AbsoluteFill
        style={{
          background: [
            `radial-gradient(circle at 18% 18%, ${cut.accent}20 0%, transparent 34%)`,
            `radial-gradient(circle at 85% 14%, ${theme.colors.accentHuman}12 0%, transparent 24%)`,
            `linear-gradient(135deg, ${theme.colors.bg} 0%, ${theme.colors.bgSoft} 100%)`,
          ].join(', '),
        }}
      />
      <Img
        src={cut.backgroundStill}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center',
          opacity: 0.14,
        }}
      />
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(90deg, rgba(5, 7, 6, 0.96) 0%, rgba(5, 7, 6, 0.88) 45%, rgba(5, 7, 6, 0.55) 100%)',
        }}
      />
    </AbsoluteFill>
  );
};

const HeaderChips = ({cut}) => {
  return (
    <div style={{display: 'flex', gap: 12, flexWrap: 'wrap'}}>
      {cut.highlights.map((item) => (
        <div
          key={item}
          style={{
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radius.chip,
            padding: '10px 14px',
            color: theme.colors.text,
            fontFamily: theme.fonts.sans,
            fontSize: 18,
            lineHeight: 1,
            letterSpacing: 0,
            backgroundColor: 'rgba(7, 10, 8, 0.42)',
          }}
        >
          {item}
        </div>
      ))}
    </div>
  );
};

const SceneBadge = ({cut, sceneIndex, sceneCount}) => {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 14,
        padding: '12px 16px',
        borderRadius: theme.radius.frame,
        backgroundColor: 'rgba(8, 11, 9, 0.72)',
        border: `1px solid ${theme.colors.border}`,
      }}
    >
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: 999,
          backgroundColor: cut.accent,
          flexShrink: 0,
        }}
      />
      <div
        style={{
          color: theme.colors.text,
          fontFamily: theme.fonts.sans,
          fontSize: 20,
          lineHeight: 1,
          letterSpacing: 0,
        }}
      >
        {cut.audienceLabel}
      </div>
      <div
        style={{
          color: theme.colors.muted,
          fontFamily: theme.fonts.sans,
          fontSize: 18,
          lineHeight: 1,
          letterSpacing: 0,
        }}
      >
        {String(sceneIndex + 1).padStart(2, '0')} / {String(sceneCount).padStart(2, '0')}
      </div>
    </div>
  );
};

const SceneText = ({cut, scene, sceneIndex, sceneCount}) => {
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 26}}>
      <SceneBadge cut={cut} sceneCount={sceneCount} sceneIndex={sceneIndex} />
      <div
        style={{
          color: cut.accent,
          fontFamily: theme.fonts.sans,
          fontSize: 22,
          fontWeight: 600,
          lineHeight: 1.15,
          letterSpacing: 0,
          textTransform: 'uppercase',
        }}
      >
        {scene.label}
      </div>
      <div
        style={{
          color: theme.colors.text,
          fontFamily: theme.fonts.sans,
          fontSize: 68,
          fontWeight: 700,
          lineHeight: 1.02,
          letterSpacing: 0,
          maxWidth: 760,
        }}
      >
        {scene.title}
      </div>
      <div
        style={{
          color: theme.colors.muted,
          fontFamily: theme.fonts.sans,
          fontSize: 28,
          lineHeight: 1.34,
          letterSpacing: 0,
          maxWidth: 720,
        }}
      >
        {scene.body}
      </div>
      <HeaderChips cut={cut} />
    </div>
  );
};

const SceneMedia = ({scene, sceneFrames}) => {
  const frame = useCurrentFrame();
  const mediaScale = interpolate(frame, [0, sceneFrames - 1], [1.008, 1], clamp);
  const mediaLift = interpolate(frame, [0, 18], [4, 0], clamp);
  const proofScale = spring({
    fps: 25,
    frame,
    config: {
      damping: 200,
      stiffness: 220,
      mass: 0.8,
    },
  });

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        minWidth: 0,
        aspectRatio: '16 / 9',
        borderRadius: theme.radius.frame,
        overflow: 'hidden',
        border: `1px solid ${theme.colors.border}`,
        backgroundColor: theme.colors.panelStrong,
        boxShadow: `0 32px 90px ${theme.colors.shadow}`,
      }}
    >
      <PromoMedia
        src={scene.clipSrc}
        style={{
          objectFit: 'contain',
          transform: `translateY(${mediaLift}px) scale(${mediaScale})`,
          transformOrigin: 'center center',
        }}
      />
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(7, 10, 8, 0.18) 0%, rgba(7, 10, 8, 0) 24%, rgba(7, 10, 8, 0) 72%, rgba(7, 10, 8, 0.42) 100%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 20,
          left: 20,
          padding: '10px 14px',
          borderRadius: theme.radius.frame,
          backgroundColor: 'rgba(7, 10, 8, 0.74)',
          border: `1px solid ${theme.colors.border}`,
          color: theme.colors.text,
          fontFamily: theme.fonts.sans,
          fontSize: 20,
          lineHeight: 1,
          letterSpacing: 0,
        }}
      >
        {scene.label}
      </div>
      <div
        style={{
          position: 'absolute',
          right: 20,
          bottom: 20,
          width: 272,
          height: 172,
          borderRadius: theme.radius.frame,
          overflow: 'hidden',
          border: `1px solid ${theme.colors.border}`,
          backgroundColor: 'rgba(7, 10, 8, 0.8)',
          boxShadow: `0 18px 44px ${theme.colors.shadow}`,
          transform: `scale(${0.9 + proofScale * 0.1})`,
          transformOrigin: 'bottom right',
        }}
      >
        <Img
          src={scene.detailStill}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
          }}
        />
      </div>
    </div>
  );
};

const SceneFooter = ({cut, scene, sceneFrames}) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, sceneFrames - 1], [0, 1], clamp);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div
        style={{
          width: '100%',
          height: 8,
          borderRadius: 999,
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${progress * 100}%`,
            height: '100%',
            borderRadius: 999,
            background: `linear-gradient(90deg, ${cut.accent} 0%, ${theme.colors.accentCool} 100%)`,
          }}
        />
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 24,
          alignItems: 'flex-end',
        }}
      >
        <div
          style={{
            maxWidth: 980,
            color: theme.colors.text,
            fontFamily: theme.fonts.sans,
            fontSize: 30,
            lineHeight: 1.2,
            letterSpacing: 0,
          }}
        >
          {scene.caption}
        </div>
        <div
          style={{
            color: theme.colors.muted,
            fontFamily: theme.fonts.sans,
            fontSize: 20,
            lineHeight: 1.2,
            letterSpacing: 0,
            textAlign: 'right',
          }}
        >
          {cut.brandLine}
        </div>
      </div>
    </div>
  );
};

const SceneLayout = ({cut, scene, sceneIndex, sceneCount}) => {
  const frame = useCurrentFrame();
  const opacity = Math.min(
    interpolate(frame, [0, 8], [0, 1], clamp),
    interpolate(frame, [scene.frames - 10, scene.frames], [1, 0], clamp),
  );
  const translateY = interpolate(frame, [0, 14], [28, 0], clamp);
  const {height} = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        opacity,
        transform: `translateY(${translateY}px)`,
      }}
    >
      <BackgroundLayer cut={cut} />
      <AbsoluteFill
        style={{
          padding: `${theme.spacing.outerY}px ${theme.spacing.outerX}px`,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: 44,
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '0.86fr 1.14fr',
            gap: theme.spacing.gap,
            alignItems: 'center',
            minHeight: height - 250,
          }}
        >
          <div style={{display: 'flex', flexDirection: 'column', gap: 32}}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              <div
                style={{
                  color: theme.colors.muted,
                  fontFamily: theme.fonts.sans,
                  fontSize: 20,
                  lineHeight: 1,
                  letterSpacing: 0,
                  textTransform: 'uppercase',
                }}
              >
                {cut.eyebrow}
              </div>
              <div
                style={{
                  width: 160,
                  height: 4,
                  borderRadius: 999,
                  backgroundColor: cut.accent,
                }}
              />
            </div>
            <SceneText cut={cut} scene={scene} sceneCount={sceneCount} sceneIndex={sceneIndex} />
          </div>
          <SceneMedia scene={scene} sceneFrames={scene.frames} />
        </div>
        <SceneFooter cut={cut} scene={scene} sceneFrames={scene.frames} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const PromoComposition = ({cutId}) => {
  const cut = cuts[cutId];

  if (!cut) {
    throw new Error(`Unknown cut: ${cutId}`);
  }

  const sceneOffsets = getSceneOffsets(cut.scenes);

  return (
    <AbsoluteFill>
      {cut.scenes.map((scene, sceneIndex) => (
        <Sequence key={scene.id} from={sceneOffsets[sceneIndex]} durationInFrames={scene.frames}>
          <SceneLayout
            cut={cut}
            scene={scene}
            sceneCount={cut.scenes.length}
            sceneIndex={sceneIndex}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
