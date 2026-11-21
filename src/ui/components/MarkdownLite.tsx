import React from 'react';
import { StyleSheet, View } from 'react-native';
import { usePalette, spacing } from '@/ui/theme/theme';
import { AppText } from '@/ui/components/primitives';

type Block =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'bullet'; text: string }
  | { type: 'ordered'; index: number; text: string }
  | { type: 'code'; text: string };

/**
 * Small renderer for the subset of Markdown the assistant actually produces.
 * It renders text only — no HTML, no links executed, no images — which keeps
 * untrusted content from becoming anything other than readable text.
 */
export function parseMarkdown(input: string): Block[] {
  const lines = input.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let inCode = false;
  let codeBuffer: string[] = [];

  for (const line of lines) {
    if (line.trimStart().startsWith('```')) {
      if (inCode) {
        blocks.push({ type: 'code', text: codeBuffer.join('\n') });
        codeBuffer = [];
        inCode = false;
      } else {
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeBuffer.push(line);
      continue;
    }
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^#{1,4}\s+/.test(trimmed)) {
      blocks.push({ type: 'heading', text: trimmed.replace(/^#{1,4}\s+/, '') });
      continue;
    }
    const bullet = /^[-*•]\s+(.*)$/.exec(trimmed);
    if (bullet) {
      blocks.push({ type: 'bullet', text: bullet[1] ?? '' });
      continue;
    }
    const ordered = /^(\d+)[.)]\s+(.*)$/.exec(trimmed);
    if (ordered) {
      blocks.push({ type: 'ordered', index: Number(ordered[1]), text: ordered[2] ?? '' });
      continue;
    }
    blocks.push({ type: 'paragraph', text: trimmed });
  }
  if (inCode && codeBuffer.length > 0) blocks.push({ type: 'code', text: codeBuffer.join('\n') });
  return blocks;
}

function InlineText({ text }: { text: string }) {
  const { palette } = usePalette();
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter((part) => part.length > 0);
  return (
    <AppText variant="body">
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <AppText key={index} variant="body" style={{ fontWeight: '700' }}>
              {part.slice(2, -2)}
            </AppText>
          );
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <AppText key={index} variant="mono" style={{ color: palette.accent }}>
              {part.slice(1, -1)}
            </AppText>
          );
        }
        return <AppText key={index} variant="body">{part}</AppText>;
      })}
    </AppText>
  );
}

export function MarkdownLite({ content }: { content: string }) {
  const { palette } = usePalette();
  const blocks = parseMarkdown(content);

  return (
    <View style={{ gap: spacing.sm }}>
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          return (
            <AppText key={index} variant="heading" style={{ marginTop: index === 0 ? 0 : spacing.xs }}>
              {block.text}
            </AppText>
          );
        }
        if (block.type === 'code') {
          return (
            <View key={index} style={{ backgroundColor: palette.surfaceElevated, borderRadius: 8, padding: spacing.sm }}>
              <AppText variant="mono">{block.text}</AppText>
            </View>
          );
        }
        if (block.type === 'bullet') {
          return (
            <View key={index} style={styles.row}>
              <AppText variant="body" color="textMuted">
                •
              </AppText>
              <View style={{ flex: 1 }}>
                <InlineText text={block.text} />
              </View>
            </View>
          );
        }
        if (block.type === 'ordered') {
          return (
            <View key={index} style={styles.row}>
              <AppText variant="body" color="textMuted">
                {block.index}.
              </AppText>
              <View style={{ flex: 1 }}>
                <InlineText text={block.text} />
              </View>
            </View>
          );
        }
        return <InlineText key={index} text={block.text} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
});
