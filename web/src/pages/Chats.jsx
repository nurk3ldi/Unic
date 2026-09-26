import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useParams } from 'react-router-dom';
import {
  IoChevronBack,
  IoChevronForward,
  IoCloseOutline,
  IoImagesOutline,
  IoLinkOutline,
  IoNotificationsOutline,
  IoSearchOutline,
} from 'react-icons/io5';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { POLL_MS, chatStamp } from '../chat.js';
import { membersLabel } from '../club.js';
import { initial, shortName } from '../people.js';
import ChatRoom from '../components/ChatRoom.jsx';
import PhotoViewer from '../components/PhotoViewer.jsx';
import SearchField from '../components/SearchField.jsx';
import './Page.css';
import './Chats.css';

/**
 * Чаты: слева список, справа открытый разговор — две панели в одной карточке,
 * разделённые волоском. Так видно, где ещё говорят, не выходя из переписки.
 *
 * В списке — клубы, чьи чаты человеку доступны: участнику его клубы,
 * университету и админу все. Чат заводится вместе с клубом, отдельно его
 * создавать не нужно.
 *
 * Разговор живёт в адресе (`/chats/:id`): ссылку можно переслать, а «назад»
 * возвращает к списку, а не к предыдущему клубу.
 *
 * Шапка разговора открывает третью колонку — сведения о клубе. Она в адрес не
 * попадает: это взгляд сбоку, а не место, куда переходят.
 */
export default function Chats() {
  const { id } = useParams();
  const { user } = useAuth();

  const [chats, setChats] = useState([]);
  const [members, setMembers] = useState([]);
  const [info, setInfo] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [media, setMedia] = useState(null); // { photos, links } открытого чата
  const [viewing, setViewing] = useState(null); // снимок из «Медиа» на весь экран
  const [findingMember, setFindingMember] = useState(false);
  const [memberQuery, setMemberQuery] = useState('');
  const memberSearchRef = useRef(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;

    async function load() {
      if (document.hidden) return;
      try {
        const { chats } = await api.chats();
        if (alive) {
          setChats(chats);
          setError('');
        }
      } catch (failure) {
        if (alive) setError(failure.message);
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  // Состав читаем отдельно: список чатов знает о клубе только название и снимок
  useEffect(() => {
    if (!id) return undefined;

    let alive = true;
    setMembers([]);
    setFindingMember(false);
    setMemberQuery('');
    api
      .clubMembers(id)
      .then(({ members }) => alive && setMembers(members))
      .catch(() => alive && setMembers([]));

    return () => {
      alive = false;
    };
  }, [id]);

  // Медиа читаем, когда открыты сведения: счётчик в строке нужен уже там.
  // Другой чат или закрытая панель — начинаем со сведений, а не с чужого «Медиа»
  useEffect(() => {
    setMediaOpen(false);
    setMedia(null);
    if (!id || !info) return undefined;

    let alive = true;
    api
      .clubMedia(id)
      .then((data) => alive && setMedia(data))
      .catch(() => alive && setMedia({ photos: [], links: [] }));

    return () => {
      alive = false;
    };
  }, [id, info]);

  const open = chats.find((chat) => chat.id === id) ?? null;
  const mediaCount = media ? media.photos.length + media.links.length : 0;

  // Уведомления по умолчанию включены: сервер хранит только выключенные
  const notify = !open?.muted;
  const permission = 'Notification' in window ? Notification.permission : 'unsupported';
  // Подпись — только когда переключатель обещает то, чего не будет: иначе он говорит сам
  const notifyNote =
    permission === 'unsupported'
      ? 'Этот браузер не показывает уведомления.'
      : notify && permission === 'denied'
        ? 'Браузер запретил уведомления для Unic — разрешите их в настройках сайта.'
        : '';

  // Состав в сведениях: «Вы» — первым, как в мессенджерах; дальше порядок сервера
  // (руководитель, затем по алфавиту). Поиск — по имени и нику
  const shownMembers = useMemo(() => {
    const query = memberQuery.trim().toLowerCase().replace(/^@/, '');
    return [...members]
      .sort((a, b) => (b.id === user?.id) - (a.id === user?.id))
      .filter(
        (member) =>
          !query ||
          member.name.toLowerCase().includes(query) ||
          member.username?.toLowerCase().includes(query),
      );
  }, [members, memberQuery, user?.id]);

  function toggleMemberSearch() {
    setMemberQuery('');
    setFindingMember((was) => {
      // Поле въезжает — фокус сразу в нём, искать можно не целясь
      if (!was) setTimeout(() => memberSearchRef.current?.querySelector('input')?.focus(), 0);
      return !was;
    });
  }

  /** Разрешение браузера спрашиваем в момент включения — это ответ на жест человека. */
  async function toggleNotify(event) {
    const enabled = event.target.checked;
    if (enabled && permission === 'default') await Notification.requestPermission();

    const apply = (muted) =>
      setChats((was) => was.map((chat) => (chat.id === id ? { ...chat, muted } : chat)));

    apply(!enabled); // переключатель отвечает сразу, сервер догоняет
    try {
      await api.setChatNotifications(id, enabled);
    } catch (failure) {
      apply(enabled);
      setError(failure.message);
    }
  }

  // Ищем и по названию клуба, и по последней реплике: в списке видно и то, и другое
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return chats;

    return chats.filter(
      (chat) =>
        chat.name.toLowerCase().includes(query) ||
        chat.last?.text.toLowerCase().includes(query),
    );
  }, [chats, search]);

  return (
    <main className="page page--flush">
      {/* Чат — рабочее место, а не страница для чтения: он встаёт вплотную
          к краям экрана, без полей и рамки карточки */}
      {/* На узком экране видно что-то одно: список либо разговор */}
      <div className={`chats${id ? ' chats--open' : ''}${info ? ' chats--info' : ''}`}>
        <div className="chats__side">
          {/* Название раздела уже горит в навигации — здесь оно только для
              скринридера, а место в шапке отдано поиску */}
          <div className="card-header">
            <h1 className="visually-hidden">Чаты</h1>
            <SearchField
              label="Поиск чата"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onClear={() => setSearch('')}
            />
          </div>

          {loading ? (
            <p className="chats__empty">Загружаем…</p>
          ) : error ? (
            <p className="chats__empty" role="alert">
              {error}
            </p>
          ) : (
            <ul className="chats__list">
              {visible.map((chat) => (
                <li key={chat.id}>
                  <NavLink className="chat-row" to={`/chats/${chat.id}`} viewTransition>
                    <span className="chat-row__photo">
                      {chat.photo ? (
                        <img className="chat-row__image" src={chat.photo} alt="" />
                      ) : (
                        <span aria-hidden="true">{initial(chat.name)}</span>
                      )}
                    </span>

                    <span className="chat-row__body">
                      <span className="chat-row__name">{chat.name}</span>
                      <span className="chat-row__last">
                        {chat.last ? (
                          <>
                            <span className="chat-row__author">
                              {shortName(chat.last.author)}:
                            </span>{' '}
                            {chat.last.text || 'Фото'}
                          </>
                        ) : (
                          'Сообщений пока нет'
                        )}
                      </span>
                    </span>

                    {chat.last && (
                      <time className="chat-row__time" dateTime={chat.last.createdAt}>
                        {chatStamp(chat.last.createdAt)}
                      </time>
                    )}
                  </NavLink>
                </li>
              ))}

              {visible.length === 0 && (
                <li>
                  <p className="chats__empty">
                    {search ? 'Ничего не нашли' : 'Чатов пока нет: вступите в клуб'}
                  </p>
                </li>
              )}
            </ul>
          )}
        </div>

        <div className="chats__room">
          {id ? (
            <>
              <div className="card-header">
                {/* На узком экране шапка разговора — единственный путь назад */}
                <Link className="card-header__back chats__back" to="/chats" viewTransition>
                  <IoChevronBack aria-hidden="true" />
                  Чаты
                </Link>

                {/* Шапка только говорит, где ты и кто здесь — никуда не ведёт:
                    в клуб ходят через раздел «Клубы» */}
                <button
                  className="chat-head"
                  type="button"
                  aria-expanded={info}
                  onClick={() => setInfo((was) => !was)}
                >
                  <span className="chat-head__photo">
                    {open?.photo ? (
                      <img className="chat-head__image" src={open.photo} alt="" />
                    ) : (
                      <span aria-hidden="true">{initial(open?.name ?? 'К')}</span>
                    )}
                  </span>

                  <span className="chat-head__body">
                    <span className="chat-head__name">{open?.name ?? 'Клуб'}</span>
                    <span className="chat-head__members">
                      {members.length > 0
                        ? members.map((member) => shortName(member.name)).join(', ')
                        : 'Участников пока нет'}
                    </span>
                  </span>

                </button>
              </div>

              {/* key: смена разговора начинает ленту заново, а не дописывает чужую */}
              <ChatRoom key={id} clubId={id} />
            </>
          ) : (
            <p className="chats__hint">Выберите чат слева</p>
          )}
        </div>

        {/* Сведения о клубе. «Медиа» открывается внутри той же колонки, как
            следующий экран в «Настройках», — назад ведёт к сведениям */}
        <aside className="chats__info">
          {mediaOpen ? (
            <div className="chats__pane" key="media">
              <div className="card-header">
                <button
                  className="card-header__action"
                  type="button"
                  aria-label="Назад к данным клуба"
                  onClick={() => setMediaOpen(false)}
                >
                  <IoChevronBack aria-hidden="true" />
                </button>

                <h2 className="card-header__title">Медиа и ссылки</h2>
              </div>

              <div className="chats__info-body chats__info-body--media">
                {!media ? (
                  <p className="chats__info-empty">Загружаем…</p>
                ) : mediaCount === 0 ? (
                  <p className="chats__info-empty">Здесь появятся фото и ссылки из чата</p>
                ) : (
                  <>
                    {media.photos.length > 0 && (
                      <section>
                        <h3 className="side-title">Фото · {media.photos.length}</h3>
                        {/* Квадраты, как в «Фото» на iPhone: сетка ровнее, чем кадры
                            разной формы; целиком снимок открывается по нажатию */}
                        <div className="chats__photos">
                          {media.photos.map((photo) => (
                            <button
                              key={photo.id}
                              className="chats__photo"
                              type="button"
                              aria-label="Открыть фото"
                              onClick={() => setViewing(photo)}
                            >
                              <img src={photo.url} alt="" loading="lazy" />
                            </button>
                          ))}
                        </div>
                      </section>
                    )}

                    {media.links.length > 0 && (
                      <section className="chats__links">
                        <h3 className="side-title">Ссылки · {media.links.length}</h3>
                        <div className="group">
                          {media.links.map((link, index) => (
                            <a
                              key={`${link.messageId}-${index}`}
                              className="group__row chats__row chats__link"
                              href={link.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <IoLinkOutline aria-hidden="true" />
                              <span className="chats__link-body">
                                {/* Протокол ничего не говорит человеку — показываем адрес */}
                                <span className="chats__link-url">
                                  {link.url.replace(/^https?:\/\//, '')}
                                </span>
                                <span className="chats__link-meta">
                                  {shortName(link.author)} · {chatStamp(link.createdAt)}
                                </span>
                              </span>
                            </a>
                          ))}
                        </div>
                      </section>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="chats__pane" key="info">
              <div className="card-header">
                <button
                  className="card-header__action chats__info-close"
                  type="button"
                  aria-label="Закрыть сведения"
                  onClick={() => setInfo(false)}
                >
                  <IoCloseOutline aria-hidden="true" />
                </button>

                <h2 className="card-header__title">Данные клуба</h2>
              </div>

              <div className="chats__info-body">
                {/* Снимок клуба крупно: панель начинается с того, о ком она */}
                <div className="chats__avatar">
                  {open?.photo ? (
                    <img className="chats__avatar-image" src={open.photo} alt="" />
                  ) : (
                    <span aria-hidden="true">{initial(open?.name ?? 'К')}</span>
                  )}
                </div>

                <h3 className="chats__info-name">{open?.name ?? 'Клуб'}</h3>
                <p className="chats__info-meta">
                  Клуб · <span className="chats__info-count">{membersLabel(members.length)}</span>
                </p>

                <div className="group chats__group">
                  <button
                    className="group__row chats__row"
                    type="button"
                    onClick={() => setMediaOpen(true)}
                  >
                    <IoImagesOutline aria-hidden="true" />
                    <span className="group__label">Медиа, ссылки и документы</span>
                    {mediaCount > 0 && <span className="chats__row-value">{mediaCount}</span>}
                    <IoChevronForward className="chats__row-more" aria-hidden="true" />
                  </button>

                  {/* Вся строка — label: переключают нажатием по ней целиком, не целясь в ручку */}
                  <label className="group__row chats__row">
                    <IoNotificationsOutline aria-hidden="true" />
                    <span className="group__label">Уведомления</span>
                    <input
                      className="switch"
                      type="checkbox"
                      role="switch"
                      checked={notify}
                      onChange={toggleNotify}
                    />
                  </label>
                </div>

                {notifyNote && <p className="chats__note">{notifyNote}</p>}

                {/* Состав — как в сведениях группы: сколько, поиск, все поимённо */}
                <section className="chats__members">
                  <div className="chats__members-head">
                    <h3 className="chats__members-title">{membersLabel(members.length)}</h3>
                    <button
                      className="search-toggle"
                      type="button"
                      aria-label="Найти участника"
                      aria-expanded={findingMember}
                      onClick={toggleMemberSearch}
                    >
                      <IoSearchOutline aria-hidden="true" />
                    </button>
                  </div>

                  {/* inert: свёрнутое поле не должно ловить Tab */}
                  <div
                    className={`reveal-y${findingMember ? ' reveal-y--open' : ''}`}
                    ref={memberSearchRef}
                    inert={!findingMember}
                  >
                    <div className="reveal-y__clip">
                      <SearchField
                        label="Поиск участника"
                        value={memberQuery}
                        onChange={(event) => setMemberQuery(event.target.value)}
                        onClear={() => setMemberQuery('')}
                      />
                    </div>
                  </div>

                  <ul className="chats__member-list">
                    {shownMembers.map((member) => (
                      <li className="chats__member" key={member.id}>
                        <span className="chats__member-avatar" aria-hidden="true">
                          {initial(member.name)}
                        </span>

                        {/* Сверху полное ФИО, под ним ник и роль: справа ник отнимал
                            у имени ширину, и длинное ФИО обрезалось */}
                        <span className="chats__member-body">
                          <span className="chats__member-name">
                            {member.id === user?.id ? 'Вы' : member.name}
                          </span>
                          <span className="chats__member-meta">
                            {member.username && `@${member.username}`}
                            {member.username && member.role === 'lead' && ' · '}
                            {member.role === 'lead' && (
                              <span className="chats__member-role">Руководитель</span>
                            )}
                          </span>
                        </span>
                      </li>
                    ))}

                    {shownMembers.length === 0 && (
                      <li className="chats__info-empty">
                        {memberQuery ? 'Никого не нашли' : 'Участников пока нет'}
                      </li>
                    )}
                  </ul>
                </section>
              </div>
            </div>
          )}
        </aside>

        <PhotoViewer photo={viewing} onClose={() => setViewing(null)} />
      </div>
    </main>
  );
}
