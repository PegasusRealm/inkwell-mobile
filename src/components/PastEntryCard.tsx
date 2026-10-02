/**
 * PastEntryCard (v2.0, 2026-10-01): one entry as a quiet row (mockup "4 Entries" .ent).
 * Closed: the date line and the first lines of the person's words, serif.
 * Open (tap): the whole entry with tags, goal snapshot, prompt, Sophy's reflection,
 * photos, Edit and Delete. Sophy's content wears coral; structure stays teal.
 *
 * Images are detected from the attachment's stored type, then its name, then the
 * URL path. Never from the raw download URL: Firebase URLs end in ?alt=media&token=.
 * Type floor: dates and body >= 15px, nothing under 13px.
 */
import React, {useState, useMemo} from 'react';
import {View, Text, StyleSheet, Pressable, TouchableOpacity, Alert, Image, Linking} from 'react-native';
import {spacing, borderRadius, fontFamily} from '../theme';
import {useTheme, ThemeColors} from '../theme/ThemeContext';
import {IWButton} from './kit';

type Attachment = {url: string; name?: string; type?: string; contentType?: string};

interface PastEntryCardProps {
  entry: {
    id: string;
    text: string;
    date: Date;
    title?: string;
    tags?: string[];
    manifestData?: {
      wish?: string;
      outcome?: string;
      opposition?: string;
      plan?: string;
    };
    promptUsed?: string;
    reflectionUsed?: string;
    reflectionNote?: string;
    attachments?: Attachment[];
  };
  onEdit?: (entryId: string) => void;
  onDelete?: (entryId: string) => void;
  /** Open the whole entry on first render (the screen passes true when a day holds one entry). */
  defaultExpanded?: boolean;
}

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'heic', 'heif'];
// MIME types that say nothing about the content; fall through to the name.
const GENERIC_TYPES = ['application/octet-stream', 'binary/octet-stream'];

/** Extension of a file name or URL, ignoring any ?query or #hash. */
const extensionOf = (value?: string): string => {
  if (!value) return '';
  const path = value.split(/[?#]/)[0];
  const last = path.split('/').pop() || '';
  const dot = last.lastIndexOf('.');
  return dot >= 0 ? last.slice(dot + 1).toLowerCase() : '';
};

export const isImageAttachment = (file: Attachment): boolean => {
  const type = (file.type || file.contentType || '').toLowerCase().trim();
  if (type && !GENERIC_TYPES.includes(type)) {
    // Mobile saves the MIME type ("image/jpeg"); older saves may hold a bare "image".
    return type.startsWith('image');
  }
  const nameExt = extensionOf(file.name);
  if (nameExt) return IMAGE_EXTENSIONS.includes(nameExt);
  return IMAGE_EXTENSIONS.includes(extensionOf(file.url));
};

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** "Today · 8:42 PM", "Yesterday · 7:10 AM", "Tue, Sep 29 · 9:05 PM", year added when it isn't this year. */
const formatDateLine = (date: Date): string => {
  if (!(date instanceof Date) || isNaN(date.getTime())) return 'Journal entry';
  const now = new Date();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  let day: string;
  if (isSameDay(date, now)) {
    day = 'Today';
  } else if (isSameDay(date, yesterday)) {
    day = 'Yesterday';
  } else {
    day = date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      ...(date.getFullYear() !== now.getFullYear() ? {year: 'numeric'} : {}),
    });
  }
  const time = date.toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit'});
  return `${day} · ${time}`;
};

const PastEntryCard: React.FC<PastEntryCardProps> = ({entry, onEdit, onDelete, defaultExpanded = false}) => {
  const {colors} = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [expanded, setExpanded] = useState(defaultExpanded);
  const [manifestExpanded, setManifestExpanded] = useState(false);
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [reflectionExpanded, setReflectionExpanded] = useState(false);
  const [brokenImages, setBrokenImages] = useState<Set<number>>(new Set());

  const hasSophy = !!(entry.reflectionUsed || entry.reflectionNote);
  // Machine tags (e.g. "manifestDate:2026-10-01") stay in the data, out of sight.
  const visibleTags = (entry.tags || []).filter(tag => typeof tag === 'string' && !tag.includes(':'));
  const attachments = (entry.attachments || []).filter(file => file && file.url);

  const handleDelete = () => {
    Alert.alert('Delete entry', 'This removes the entry for good. It cannot be undone.', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => onDelete?.(entry.id),
      },
    ]);
  };

  const openFile = (url: string) => {
    Linking.openURL(url).catch(() => Alert.alert('Could not open', 'That file could not be opened on this phone.'));
  };

  return (
    <View style={styles.row}>
      {/* Date line + the person's words. Tap opens or closes the whole entry. */}
      <Pressable
        onPress={() => setExpanded(prev => !prev)}
        accessibilityRole="button"
        accessibilityState={{expanded}}
        accessibilityHint={expanded ? 'Closes this entry' : 'Opens the whole entry'}>
        <View style={styles.dateRow}>
          <Text style={styles.dateLine}>{formatDateLine(entry.date)}</Text>
          {hasSophy && (
            <View style={styles.sophyMark}>
              <View style={styles.sophyDot} />
              <Text style={styles.sophyMarkText}>Sophy</Text>
            </View>
          )}
        </View>
        <Text style={styles.entryText} numberOfLines={expanded ? undefined : 3}>
          {entry.text}
        </Text>
        {!expanded && attachments.length > 0 && (
          <Text style={styles.metaLine}>
            {attachments.length} attachment{attachments.length === 1 ? '' : 's'}
          </Text>
        )}
      </Pressable>

      {expanded && (
        <View style={styles.details}>
          {/* Tags */}
          {visibleTags.length > 0 && (
            <View style={styles.tagsContainer}>
              {visibleTags.map((tag, index) => (
                <View key={`${tag}-${index}`} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Goal snapshot: structure, teal */}
          {entry.manifestData && (
            <View style={styles.toggleSection}>
              <TouchableOpacity style={styles.toggleButton} onPress={() => setManifestExpanded(prev => !prev)}>
                <Text style={styles.toggleButtonText}>
                  {manifestExpanded ? 'Hide goal snapshot' : 'Show goal snapshot'}
                </Text>
              </TouchableOpacity>
              {manifestExpanded && (
                <View style={styles.toggleContent}>
                  <Text style={styles.toggleContentText}>
                    <Text style={styles.bold}>Want:</Text> {entry.manifestData.wish || 'Not set'}
                    {'\n'}
                    <Text style={styles.bold}>Imagine:</Text> {entry.manifestData.outcome || 'Not set'}
                    {'\n'}
                    <Text style={styles.bold}>Snags:</Text> {entry.manifestData.opposition || 'Not set'}
                    {'\n'}
                    <Text style={styles.bold}>How:</Text> {entry.manifestData.plan || 'Not set'}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Prompt: structure, teal */}
          {entry.promptUsed && (
            <View style={styles.toggleSection}>
              <TouchableOpacity style={styles.toggleButton} onPress={() => setPromptExpanded(prev => !prev)}>
                <Text style={styles.toggleButtonText}>{promptExpanded ? 'Hide prompt' : 'Show prompt'}</Text>
              </TouchableOpacity>
              {promptExpanded && (
                <View style={styles.toggleContent}>
                  <Text style={styles.promptText}>{entry.promptUsed}</Text>
                </View>
              )}
            </View>
          )}

          {/* Sophy's reflection: her content, coral */}
          {entry.reflectionUsed && (
            <View style={styles.toggleSection}>
              <TouchableOpacity style={styles.toggleButton} onPress={() => setReflectionExpanded(prev => !prev)}>
                <Text style={styles.sophyToggleText}>
                  {reflectionExpanded ? "Hide Sophy's reflection" : "Show Sophy's reflection"}
                </Text>
              </TouchableOpacity>
              {reflectionExpanded && (
                <View style={styles.sophyContent}>
                  <Text style={styles.sophyWho}>SOPHY</Text>
                  <Text style={styles.sophyText}>{entry.reflectionUsed}</Text>
                </View>
              )}
            </View>
          )}

          {/* Reflection note (older field) */}
          {entry.reflectionNote && (
            <View style={styles.sophyContent}>
              <Text style={styles.sophyWho}>SOPHY</Text>
              <Text style={styles.sophyText}>{entry.reflectionNote}</Text>
            </View>
          )}

          {/* Attachments: photos render as photos, everything else as a file tile */}
          {attachments.length > 0 && (
            <View style={styles.attachmentThumbnails}>
              {attachments.map((file, index) => {
                const showImage = isImageAttachment(file) && !brokenImages.has(index);
                return showImage ? (
                  <TouchableOpacity
                    key={index}
                    onPress={() => openFile(file.url)}
                    accessibilityRole="imagebutton"
                    accessibilityLabel={file.name ? `Photo ${file.name}` : 'Photo'}>
                    <Image
                      source={{uri: file.url}}
                      style={styles.thumbnail}
                      resizeMode="cover"
                      onError={() => setBrokenImages(prev => new Set(prev).add(index))}
                    />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    key={index}
                    style={styles.filePlaceholder}
                    onPress={() => openFile(file.url)}
                    accessibilityLabel={file.name ? `File ${file.name}` : 'File'}>
                    <Text style={styles.fileIcon}>FILE</Text>
                    <Text style={styles.fileName} numberOfLines={2}>
                      {file.name || 'Attachment'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Actions: quiet */}
          {(onEdit || onDelete) && (
            <View style={styles.actions}>
              {onEdit && <IWButton voice="gray" small title="Edit" onPress={() => onEdit(entry.id)} />}
              {onDelete && <IWButton voice="gray" small title="Delete" onPress={handleDelete} />}
            </View>
          )}
        </View>
      )}
    </View>
  );
};

// Dynamic styles based on theme colors
const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    // One row: hairline above, air around (mockup .ent)
    row: {
      paddingVertical: spacing.base,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    dateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      marginBottom: spacing.xs,
    },
    dateLine: {
      flexShrink: 1,
      fontFamily: fontFamily.button,
      fontSize: 15,
      color: colors.fontMuted,
    },
    sophyMark: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    sophyDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.sophyLight,
    },
    sophyMarkText: {
      fontFamily: fontFamily.button,
      fontSize: 15,
      color: colors.sophyLight,
    },
    entryText: {
      fontFamily: fontFamily.serif,
      fontSize: 17,
      lineHeight: 25,
      color: colors.fontMain,
    },
    metaLine: {
      fontFamily: fontFamily.body,
      fontSize: 15,
      color: colors.fontMuted,
      marginTop: spacing.xs,
    },
    details: {
      marginTop: spacing.md,
    },
    tagsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      marginBottom: spacing.sm,
    },
    tag: {
      paddingHorizontal: spacing.md,
      paddingVertical: 4,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.borderMedium,
    },
    tagText: {
      fontFamily: fontFamily.button,
      fontSize: 14,
      color: colors.fontSecondary,
    },
    toggleSection: {
      marginBottom: spacing.xs,
    },
    toggleButton: {
      paddingVertical: 4,
      minHeight: 44,
      justifyContent: 'center',
    },
    toggleButtonText: {
      color: colors.brandPrimary,
      fontSize: 15,
      fontFamily: fontFamily.buttonBold,
    },
    sophyToggleText: {
      color: colors.sophyAccent,
      fontSize: 15,
      fontFamily: fontFamily.buttonBold,
    },
    toggleContent: {
      backgroundColor: colors.bgSection,
      padding: spacing.md,
      borderRadius: borderRadius.sm,
      borderLeftWidth: 3,
      borderLeftColor: colors.brandPrimary,
      marginTop: 2,
      marginBottom: spacing.sm,
    },
    toggleContentText: {
      fontSize: 15,
      fontFamily: fontFamily.body,
      color: colors.fontMain,
      lineHeight: 23,
    },
    promptText: {
      fontFamily: fontFamily.serifItalic,
      fontStyle: 'italic',
      fontSize: 16,
      color: colors.fontMain,
      lineHeight: 23,
    },
    bold: {
      fontFamily: fontFamily.bodyBold,
    },
    // Sophy surfaces: coral only, her words serif italic
    sophyContent: {
      backgroundColor: colors.sophyTint,
      borderWidth: 1,
      borderColor: colors.sophyBorder,
      padding: spacing.md,
      borderRadius: borderRadius.lg,
      marginTop: 2,
      marginBottom: spacing.sm,
    },
    sophyWho: {
      fontFamily: fontFamily.bodyBold,
      fontSize: 13,
      letterSpacing: 1.8,
      color: colors.sophyLight,
      marginBottom: 4,
    },
    sophyText: {
      fontFamily: fontFamily.serifItalic,
      fontStyle: 'italic',
      fontSize: 16,
      color: colors.fontMain,
      lineHeight: 23,
    },
    attachmentThumbnails: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.xs,
      marginBottom: spacing.sm,
    },
    thumbnail: {
      width: 96,
      height: 96,
      borderRadius: borderRadius.lg,
      backgroundColor: colors.bgMuted,
    },
    filePlaceholder: {
      width: 96,
      height: 96,
      borderRadius: borderRadius.lg,
      backgroundColor: colors.bgSection,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.borderLight,
      padding: spacing.xs,
    },
    fileIcon: {
      fontFamily: fontFamily.bodyBold,
      fontSize: 13,
      color: colors.fontMuted,
      letterSpacing: 1,
    },
    fileName: {
      fontSize: 13,
      fontFamily: fontFamily.body,
      color: colors.fontMuted,
      marginTop: 4,
      textAlign: 'center',
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
  });

export default PastEntryCard;
