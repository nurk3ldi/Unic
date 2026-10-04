import { HugeiconsIcon } from '@hugeicons/react';
import {
  Airplane01Icon,
  Album02Icon,
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowLeftRightIcon,
  ArrowRight01Icon,
  ArrowTurnBackwardIcon,
  ArrowUp01Icon,
  Calendar04Icon,
  Camera01Icon,
  Cancel01Icon,
  CloudUploadIcon,
  MessageCircleIcon,
  Copy01Icon,
  Delete02Icon,
  Download01Icon,
  FavouriteIcon,
  File01Icon,
  FootballIcon,
  Hamburger01Icon,
  HappyIcon,
  Home09Icon,
  Idea01Icon,
  Image01Icon,
  Leaf01Icon,
  Link01Icon,
  Logout01Icon,
  Mic01Icon,
  MinusSignCircleIcon,
  MoreHorizontalIcon,
  MusicNote01Icon,
  Notification01Icon,
  PauseIcon,
  PinIcon,
  PlayIcon,
  PlusSignIcon,
  Search01Icon,
  SendIcon,
  Tick02Icon,
  TickDouble01Icon,
  UnavailableIcon,
  UserCircleIcon,
  UserGroupIcon,
  UserRemove01Icon,
  Video01Icon,
  ViewIcon,
  ViewOffSlashIcon,
  VolumeHighIcon,
  VolumeMute01Icon,
} from '@hugeicons/core-free-icons';

/**
 * Словарь иконок проекта — Hugeicons (§2).
 *
 * **Зачем отдельный файл.** Hugeicons рисуются не компонентом на знак, а одним
 * `HugeiconsIcon`, которому передают данные знака. Если бы это писалось в каждом
 * месте, разметка обросла бы служебным `icon={...}`. Здесь имена названы по делу
 * («закрыть», «поиск»), и весь словарь проекта виден в одном списке.
 *
 * `size="1em"` — чтобы размер по-прежнему задавался стилями (`svg { width }`),
 * как было раньше; вызывающий может передать своё. Толщина штриха — 1.5, и она
 * подчиняется CSS (`stroke-width`), потому что знаки нарисованы штрихом.
 */
const icon = (glyph) =>
  function Icon(props) {
    return <HugeiconsIcon icon={glyph} size="1em" {...props} />;
  };

/**
 * Залитый знак. В свободном наборе Hugeicons всё нарисовано штрихом, а для
 * ▶, ❚❚, микрофона и «···» контур не годится: на синем пузыре он почти не
 * виден. Фигуры у них замкнутые, поэтому заливка даёт ровно тот плотный знак,
 * который был раньше.
 */
const solid = (glyph) =>
  function Icon({ style, ...props }) {
    return (
      <HugeiconsIcon icon={glyph} size="1em" style={{ fill: 'currentColor', ...style }} {...props} />
    );
  };

export const IconArrowDown = icon(ArrowDown01Icon);
export const IconArrowUp = icon(ArrowUp01Icon);
export const IconBall = icon(FootballIcon);
export const IconBan = icon(UnavailableIcon);
export const IconBell = icon(Notification01Icon);
export const IconBulb = icon(Idea01Icon);
export const IconCalendar = icon(Calendar04Icon);
export const IconCamera = icon(Camera01Icon);
export const IconChats = icon(SendIcon);
// Тот же бумажный самолёт: в навигации он значит «Чаты», под публикацией — «Отправить»
export const IconSend = IconChats;
export const IconCheck = icon(Tick02Icon);
export const IconCheckDouble = icon(TickDouble01Icon);
export const IconChevronDown = icon(ArrowDown01Icon);
export const IconComment = icon(MessageCircleIcon);
export const IconChevronLeft = icon(ArrowLeft01Icon);
export const IconChevronRight = icon(ArrowRight01Icon);
export const IconChevronUp = icon(ArrowUp01Icon);
export const IconClose = icon(Cancel01Icon);
export const IconClubs = icon(UserGroupIcon);
export const IconCopy = icon(Copy01Icon);
export const IconDocument = icon(File01Icon);
export const IconDots = solid(MoreHorizontalIcon);
export const IconDownload = icon(Download01Icon);
export const IconEye = icon(ViewIcon);
export const IconEyeOff = icon(ViewOffSlashIcon);
export const IconFood = icon(Hamburger01Icon);
export const IconHeart = icon(FavouriteIcon);
export const IconHome = icon(Home09Icon);
export const IconImage = icon(Image01Icon);
export const IconImages = icon(Album02Icon);
export const IconLeaf = icon(Leaf01Icon);
export const IconLink = icon(Link01Icon);
export const IconMic = icon(Mic01Icon);
export const IconMicSolid = solid(Mic01Icon);
export const IconMinusCircle = icon(MinusSignCircleIcon);
export const IconMusic = icon(MusicNote01Icon);
export const IconPause = solid(PauseIcon);
export const IconPin = icon(PinIcon);
export const IconPlane = icon(Airplane01Icon);
export const IconPlay = solid(PlayIcon);
export const IconPlus = icon(PlusSignIcon);
export const IconReply = icon(ArrowTurnBackwardIcon);
export const IconSearch = icon(Search01Icon);
export const IconSignOut = icon(Logout01Icon);
export const IconSmile = icon(HappyIcon);
export const IconSwap = icon(ArrowLeftRightIcon);
export const IconTrash = icon(Delete02Icon);
export const IconUpload = icon(CloudUploadIcon);
export const IconUser = icon(UserCircleIcon);
export const IconUserRemove = icon(UserRemove01Icon);
export const IconVideo = icon(Video01Icon);
export const IconVolume = icon(VolumeHighIcon);
export const IconVolumeOff = icon(VolumeMute01Icon);
