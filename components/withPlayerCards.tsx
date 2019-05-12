import { forEach } from 'lodash';
import { connect } from 'react-redux';
import { connectRealm, CardResults } from 'react-native-realm';
import hoistNonReactStatic from 'hoist-non-react-statics';

import Card, { CardsMap } from '../data/Card';
import { AppState, getTabooSet } from '../reducers';

export interface PlayerCardProps {
  realm: Realm;
  cards: CardsMap;
  investigators: CardsMap;
  tabooSetId?: number;
}

export interface TabooSetOverride {
  tabooSetOverride?: number;
}

export default function withPlayerCards<Props>(
  WrappedComponent: React.ComponentType<Props & PlayerCardProps>
): React.ComponentType<Props & TabooSetOverride> {
  interface ReduxProps {
    tabooSetId?: number;
  }
  const mapStateToProps = (
    state: AppState,
    props: Props & TabooSetOverride
  ): ReduxProps => {
    return {
      tabooSetId: getTabooSet(state, props.tabooSetOverride),
    };
  };
  const result = connect<ReduxProps, {}, Props & TabooSetOverride, AppState>(mapStateToProps)(
    connectRealm<Props & ReduxProps, PlayerCardProps, Card>(
      WrappedComponent, {
        schemas: ['Card'],
        mapToProps(
          results: CardResults<Card>,
          realm: Realm,
          props: Props & ReduxProps
        ): PlayerCardProps {
          const investigators: CardsMap = {};
          const cards: CardsMap = {};
          forEach(
            results.cards.filtered(
              `((type_code == "investigator" AND encounter_code == null) OR deck_limit > 0) and ${Card.tabooSetQuery(props.tabooSetId)}`),
            card => {
              cards[card.code] = card;
              if (card.type_code === 'investigator') {
                investigators[card.code] = card;
              }
            });
          return {
            realm,
            cards,
            investigators,
            tabooSetId: props.tabooSetId,
          };
        },
      })
  );
  hoistNonReactStatic(result, WrappedComponent);
  return result as React.ComponentType<Props & TabooSetOverride>;
}
