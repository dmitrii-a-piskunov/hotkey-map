export const ru = {
  app: {
    title: 'Hotkey Map',
    tagline: 'Игровые бинды на экранной копии клавиатуры и мыши',
    version: 'Версия',
  },
  header: {
    inputMode: 'Режим ввода',
    modeCheck: 'Проверка нажатий',
    modeNav: 'Навигация',
    labelLang: 'Язык подписей',
    autoLang: 'Автопереключение раскладки',
    autoLangShort: 'Авто',
    autoLangHint: 'В режимах EN и RU раскладка подписей переключается по последней нажатой клавише',
    view: 'Вид клавиатуры',
  },
  devices: {
    stage: 'Клавиатура и мышь',
    keyboard: 'Клавиатура',
    mouse: 'Мышь',
    notAssignable: 'Не назначается',
    notPassedToGames: 'Эта клавиша не передаётся в игры',
    knob: 'Регулятор',
    /** Подписи-выноски у мыши */
    mouseCallouts: {
      Mouse4: 'Mouse 4',
      Mouse5: 'Mouse 5',
      MouseMiddle: 'Mouse 3',
      WheelUp: 'Mouse wheel up',
      WheelDown: 'Mouse wheel down',
    },
  },
  /** Ошибки целостности данных: показываются в списке ошибок импорта */
  dataErrors: {
    duplicateId: 'Повторяющийся идентификатор',
    globalContext: 'В игре должен быть ровно один контекст «Везде»',
    unknownContext: 'Ссылка на несуществующий контекст',
    unknownCategory: 'Ссылка на несуществующую категорию',
    unknownAction: 'Бинд ссылается на несуществующее действие',
    unknownOption: 'Ссылка на несуществующий вариант',
    inputInTwoGroups: 'Клавиша входит в две группы профиля',
    duplicateGameName: 'Игра с таким названием уже есть',
  },
} as const
