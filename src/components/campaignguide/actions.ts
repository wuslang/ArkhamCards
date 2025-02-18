import { map } from 'lodash';
import { ThunkAction } from 'redux-thunk';

import {
  CampaignId,
  GuideInput,
  GUIDE_SET_INPUT,
  GUIDE_RESET_SCENARIO,
  GUIDE_UNDO_INPUT,
  UpdateCampaignAction,
  GuideSetInputAction,
  GuideResetScenarioAction,
  GuideStartSideScenarioInput,
  GuideStartCustomSideScenarioInput,
  GuideUndoInputAction,
  SupplyCounts,
  NumberChoices,
  StringChoices,
  InvestigatorTraumaData,
  GUIDE_UPDATE_ACHIEVEMENT,
  GuideUpdateAchievementAction,
  DeckId,
  Campaign,
  UploadedCampaignId,
  UPDATE_CAMPAIGN,
} from '@actions/types';

import { AppState, makeCampaignGuideStateSelector, makeCampaignSelector } from '@reducers';
import { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { CreateCampaignActions, GuideActions } from '@data/remote/campaigns';
import { DeckActions, uploadCampaignDeckHelper } from '@data/remote/decks';
import CampaignGuideStateT from '@data/interfaces/CampaignGuideStateT';

function uploadCampaignHelper(
  campaign: Campaign,
  campaignId: UploadedCampaignId,
  guided: boolean,
  actions: CreateCampaignActions,
  deckActions: DeckActions
): ThunkAction<void, AppState, unknown, UpdateCampaignAction> {
  return async(dispatch, getState) => {
    // Do something with deck uploads?
    if (guided) {
      const state = getState();
      const guide = makeCampaignGuideStateSelector()(state, campaign.uuid);
      actions.uploadNewCampaign(campaignId.serverId, campaign, guide);
    } else {
      actions.uploadNewCampaign(campaignId.serverId, campaign, undefined);
    }
    dispatch({
      type: UPDATE_CAMPAIGN,
      id: campaignId,
      campaign: { serverId: campaignId.serverId },
      now: new Date(),
    });
    Promise.all(map(campaign.deckIds || [], deckId => {
      return dispatch(uploadCampaignDeckHelper(campaignId, deckId, deckActions));
    }));
  };
}

type UploadCampaignResult = {
  type: 'linked';
  ids: {
    campaignId: UploadedCampaignId;
    campaignIdA: UploadedCampaignId;
    campaignIdB: UploadedCampaignId;
  };
} | {
  type: 'single';
  id: UploadedCampaignId;
}

export function uploadCampaign(
  actions: CreateCampaignActions,
  deckActions: DeckActions,
  campaignId: CampaignId
): ThunkAction<Promise<UploadCampaignResult>, AppState, unknown, UpdateCampaignAction> {
  return async(dispatch, getState): Promise<UploadCampaignResult> => {
    const state = getState();
    if (campaignId.serverId) {
      return {
        type: 'single',
        id: campaignId,
      };
    }
    const campaign = makeCampaignSelector()(state, campaignId.campaignId);
    if (!campaign) {
      throw new Error('Something went wrong');
    }
    const guided = !!campaign.guided;
    if (campaign.linkUuid) {
      const ids = await actions.createLinkedCampaign(campaignId.campaignId, campaign.linkUuid, guided);
      const campaignA = makeCampaignSelector()(state, campaign.linkUuid.campaignIdA);
      if (campaignA) {
        dispatch(uploadCampaignHelper(campaignA, ids.campaignIdA, guided, actions, deckActions));
      }
      const campaignB = makeCampaignSelector()(state, campaign.linkUuid.campaignIdB);
      if (campaignB) {
        dispatch(uploadCampaignHelper(campaignB, ids.campaignIdB, guided, actions, deckActions));
      }
      dispatch(uploadCampaignHelper(campaign, ids.campaignId, guided, actions, deckActions));
      return {
        type: 'linked',
        ids,
      };
    }
    const newCampaignId = await actions.createCampaign(campaignId.campaignId, guided);
    dispatch(uploadCampaignHelper(campaign, newCampaignId, guided, actions, deckActions));
    return {
      type: 'single',
      id: newCampaignId,
    };
  };
}

export function undo(
  user: FirebaseAuthTypes.User | undefined,
  actions: GuideActions,
  campaignId: CampaignId,
  scenarioId: string,
  campaignState: CampaignGuideStateT
): ThunkAction<void, AppState, unknown, GuideUndoInputAction> {
  return (dispatch) => {
    if (user && campaignId.serverId) {
      const undoInputs = campaignState.undoInputs(scenarioId);
      if (undoInputs.length) {
        actions.removeInputs(campaignId, undoInputs);
      }
    } else {
      dispatch({
        type: GUIDE_UNDO_INPUT,
        campaignId,
        scenarioId,
        now: new Date(),
      });
    }
  };
}

function updateAchievement(
  user: FirebaseAuthTypes.User | undefined,
  action: GuideUpdateAchievementAction
): ThunkAction<void, AppState, unknown, GuideUpdateAchievementAction> {
  return (dispatch) => {
    dispatch(action);
  };
}

export function setBinaryAchievement(
  user: FirebaseAuthTypes.User | undefined,
  actions: GuideActions,
  campaignId: CampaignId,
  achievementId: string,
  value: boolean,
): ThunkAction<void, AppState, unknown, GuideUpdateAchievementAction> {
  return (dispatch) => {
    if (user && campaignId.serverId) {
      actions.setBinaryAchievement(campaignId, achievementId, value);
    } else {
      dispatch(
        updateAchievement(user, {
          type: GUIDE_UPDATE_ACHIEVEMENT,
          campaignId,
          id: achievementId,
          operation: value ? 'set' : 'clear',
          now: new Date(),
        })
      );
    }
  };
}

export function incCountAchievement(
  user: FirebaseAuthTypes.User | undefined,
  actions: GuideActions,
  campaignId: CampaignId,
  achievementId: string,
  max?: number
): ThunkAction<void, AppState, unknown, GuideUpdateAchievementAction> {
  return (dispatch) => {
    if (user && campaignId.serverId) {
      actions.incAchievement(campaignId, achievementId, max);
    } else {
      dispatch(updateAchievement(user, {
        type: GUIDE_UPDATE_ACHIEVEMENT,
        campaignId,
        id: achievementId,
        operation: 'inc',
        max,
        now: new Date(),
      }));
    }
  };
}

export function decCountAchievement(
  user: FirebaseAuthTypes.User | undefined,
  actions: GuideActions,
  campaignId: CampaignId,
  achievementId: string,
  max?: number
): ThunkAction<void, AppState, unknown, GuideUpdateAchievementAction> {
  return (dispatch) => {
    if (user && campaignId.serverId) {
      actions.decAchievement(campaignId, achievementId);
    } else {
      dispatch(updateAchievement(user, {
        type: GUIDE_UPDATE_ACHIEVEMENT,
        campaignId,
        id: achievementId,
        operation: 'dec',
        max,
        now: new Date(),
      }));
    }
  };
}

export function resetScenario(
  user: FirebaseAuthTypes.User | undefined,
  campaignId: CampaignId,
  scenarioId: string
): ThunkAction<void, AppState, unknown, GuideResetScenarioAction> {
  return (dispatch) => {
    dispatch({
      type: GUIDE_RESET_SCENARIO,
      campaignId,
      scenarioId,
      now: new Date(),
    });
  };
}

function setGuideInputAction(
  user: FirebaseAuthTypes.User | undefined,
  actions: GuideActions,
  campaignId: CampaignId,
  input: GuideInput
): ThunkAction<void, AppState, unknown, GuideSetInputAction> {
  return async(dispatch) => {
    if (user && campaignId.serverId) {
      actions.setInput(campaignId, input);
    } else {
      dispatch({
        type: GUIDE_SET_INPUT,
        campaignId,
        input,
        now: new Date(),
      });
    }
  };
}
export function startScenario(
  user: FirebaseAuthTypes.User | undefined,
  actions: GuideActions,
  campaignId: CampaignId,
  scenario: string
): ThunkAction<void, AppState, unknown, GuideSetInputAction> {
  return setGuideInputAction(user, actions, campaignId, {
    type: 'start_scenario',
    scenario,
    step: undefined,
  });
}


export function startSideScenario(
  user: FirebaseAuthTypes.User | undefined,
  actions: GuideActions,
  campaignId: CampaignId,
  scenario: GuideStartSideScenarioInput | GuideStartCustomSideScenarioInput
): ThunkAction<void, AppState, unknown, GuideSetInputAction> {
  return setGuideInputAction(user, actions, campaignId, scenario);
}

export function setScenarioDecision(
  user: FirebaseAuthTypes.User | undefined,
  actions: GuideActions,
  campaignId: CampaignId,
  step: string,
  value: boolean,
  scenario?: string
): ThunkAction<void, AppState, unknown, GuideSetInputAction> {
  return setGuideInputAction(user, actions, campaignId, {
    type: 'decision',
    scenario,
    step,
    decision: value,
  });
}

export function setInterScenarioData(
  user: FirebaseAuthTypes.User | undefined,
  actions: GuideActions,
  campaignId: CampaignId,
  value: InvestigatorTraumaData,
  scenario?: string
): ThunkAction<void, AppState, unknown, GuideSetInputAction> {
  return setGuideInputAction(user, actions, campaignId, {
    type: 'inter_scenario',
    scenario,
    investigatorData: value,
    step: undefined,
  });
}

export function setScenarioCount(
  user: FirebaseAuthTypes.User | undefined,
  actions: GuideActions,
  campaignId: CampaignId,
  step: string,
  value: number,
  scenario?: string
): ThunkAction<void, AppState, unknown, GuideSetInputAction> {
  return setGuideInputAction(user, actions, campaignId, {
    type: 'count',
    scenario,
    step,
    count: value,
  });
}

export function setScenarioSupplies(
  user: FirebaseAuthTypes.User | undefined,
  actions: GuideActions,
  campaignId: CampaignId,
  step: string,
  supplies: SupplyCounts,
  scenario?: string
): ThunkAction<void, AppState, unknown, GuideSetInputAction> {
  return setGuideInputAction(user, actions, campaignId, {
    type: 'supplies',
    scenario,
    step,
    supplies,
  });
}

export function setScenarioNumberChoices(
  user: FirebaseAuthTypes.User | undefined,
  actions: GuideActions,
  campaignId: CampaignId,
  step: string,
  choices: NumberChoices,
  deckId?: DeckId,
  scenario?: string
): ThunkAction<void, AppState, unknown, GuideSetInputAction> {
  return setGuideInputAction(user, actions, campaignId, {
    type: 'choice_list',
    scenario,
    step,
    choices,
    deckId,
  });
}

export function setScenarioStringChoices(
  user: FirebaseAuthTypes.User | undefined,
  actions: GuideActions,
  campaignId: CampaignId,
  step: string,
  choices: StringChoices,
  scenario?: string
): ThunkAction<void, AppState, unknown, GuideSetInputAction> {
  return setGuideInputAction(user, actions, campaignId, {
    type: 'string_choices',
    scenario,
    step,
    choices,
  });
}

export function setScenarioChoice(
  user: FirebaseAuthTypes.User | undefined,
  actions: GuideActions,
  campaignId: CampaignId,
  step: string,
  choice: number,
  scenario?: string
): ThunkAction<void, AppState, unknown, GuideSetInputAction> {
  return setGuideInputAction(user, actions, campaignId, {
    type: 'choice',
    scenario,
    step,
    choice,
  });
}

export function setScenarioText(
  user: FirebaseAuthTypes.User | undefined,
  actions: GuideActions,
  campaignId: CampaignId,
  step: string,
  text: string,
  scenario?: string
): ThunkAction<void, AppState, unknown, GuideSetInputAction> {
  return setGuideInputAction(user, actions, campaignId, {
    type: 'text',
    scenario,
    step,
    text,
  });
}

export function setCampaignLink(
  user: FirebaseAuthTypes.User | undefined,
  actions: GuideActions,
  campaignId: CampaignId,
  step: string,
  decision: string,
  scenario?: string
): ThunkAction<void, AppState, unknown, GuideSetInputAction> {
  return setGuideInputAction(user, actions, campaignId, {
    type: 'campaign_link',
    scenario,
    step,
    decision,
  });
}

export default {
  startScenario,
  startSideScenario,
  resetScenario,
  setScenarioCount,
  setScenarioDecision,
  setScenarioChoice,
  setScenarioSupplies,
  setScenarioNumberChoices,
  setScenarioStringChoices,
  setScenarioText,
  setInterScenarioData,
  setCampaignLink,
  undo,
  setBinaryAchievement,
  incCountAchievement,
  decCountAchievement,
};
