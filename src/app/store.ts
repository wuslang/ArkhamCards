import { filter, forEach, values } from 'lodash';
import { createStore, applyMiddleware, compose } from 'redux';
import thunk from 'redux-thunk';
import { createOffline } from '@redux-offline/redux-offline';
import offlineConfig from '@redux-offline/redux-offline/lib/defaults';
import { createMigrate, persistStore, persistReducer } from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';

import reducers, { AppState } from '@reducers';
import { DeckId, LegacyCampaign, ChaosBagResults, LegacyDeck } from '@actions/types';
import { migrateCampaigns, migrateDecks, migrateGuides } from '@reducers/migrators';
// import Reactotron from './ReactotronConfig';

/**
 * How to refresh discarded offline tokens properly.
const discard = async(error, _action, _retries) => {
  if (!status in error) return false;

  if (error.status === 401) {
    const newAccessToken = await refreshAccessToken();
    localStorage.set('accessToken', newAccessToken);
    return newAccessToken == null;
  }

  return 400 <= error.status && error.status < 500;
}
*/

export default function configureStore(initialState: AppState) {
  const offline = createOffline({
    ...offlineConfig,
    // @ts-ignore
    persist: false,
  });

  function migrateV1(state: AppState): AppState {
    const newState: AppState = { ...state };

    let deckMap: { [key: string]: DeckId | undefined} = {};
    if (state.decks && state.decks.all) {
      const [all, newDeckMap] = migrateDecks(values(state.decks.all) as LegacyDeck[]);
      deckMap = newDeckMap;
      newState.decks = {
        ...state.decks,
        all,
        replacedLocalIds: {},
      };
    }
    if (state.campaigns && state.campaigns.all) {
      const [all, campaignMapping] = migrateCampaigns(
        values(state.campaigns.all) as LegacyCampaign[],
        deckMap,
        newState.decks.all,
      );
      const chaosBagResults: { [uuid: string]: ChaosBagResults | undefined } = {};
      forEach(state.campaigns.chaosBagResults || {}, (bag, id) => {
        if (campaignMapping[id]) {
          chaosBagResults[campaignMapping[id]] = bag;
        }
      });
      newState.campaigns = {
        ...state.campaigns,
        all,
        chaosBagResults,
      };

      if (state.guides && state.guides.all) {
        newState.guides = {
          ...state.guides,
          all: migrateGuides(state.guides.all, campaignMapping, deckMap),
        };
      }
    }
    return newState;
  }

  const migrations = {
    0: (state: any) => {
      const newState = { ...state };
      if (newState.weaknesses) {
        delete newState.weaknesses;
      }
      return newState;
    },
  };

  const persistConfig = {
    key: 'persist',
    version: 0,
    storage: AsyncStorage,
    // Disable timeout since hitting the timeout causes it to reset all data?
    // WHY is that the default behavior?!?!?
    timeout: 0,
    // These all have some transient fields and are handled separately.
    blacklist: ['cards', 'decks', 'packs', 'dissonantVoices', 'guides', 'signedIn', 'filters', 'deckEdits'],
    migrate: createMigrate(migrations, { debug: false }),
  };

  const reducer = persistReducer(
    persistConfig,
    offline.enhanceReducer(reducers)
  );

  // @ts-ignore
  const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;

  const store = createStore(
    reducer,
    initialState,
    composeEnhancers(
      // Reactotron.createEnhancer(),
      applyMiddleware(
        ...filter([
          thunk,
          offline.middleware,
        ], Boolean)),
      offline.enhanceStore)
  );
  const persistor = persistStore(store, null, () => {
    console.log('PersistStore loaded.');
  });

  return { store, persistor };
}
