import React, { useCallback, useContext, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Navigation } from 'react-native-navigation';
import { useDispatch } from 'react-redux';
import { t } from 'ttag';

import { updateCampaignName } from '@components/campaign/actions';
import withCampaignGuideContext, { CampaignGuideInputProps, InjectedCampaignGuideContextProps } from '@components/campaignguide/withCampaignGuideContext';
import { NavigationProps } from '@components/nav/types';
import { useNavigationButtonPressed } from '@components/core/hooks';
import CampaignGuideContext from './CampaignGuideContext';
import { useStopAudioOnUnmount } from '@lib/audio/narrationPlayer';
import { useAlertDialog, useCountDialog, useSimpleTextDialog } from '@components/deck/dialogs';
import CampaignDetailTab from './CampaignDetailTab';
import UploadCampaignButton from '@components/campaign/UploadCampaignButton';
import DeleteCampaignButton from '@components/campaign/DeleteCampaignButton';
import space from '@styles/space';
import { useUpdateCampaignActions } from '@data/remote/campaigns';
import { useDeckActions } from '@data/remote/decks';
import StyleContext from '@styles/StyleContext';

export type CampaignGuideProps = CampaignGuideInputProps;

type Props = CampaignGuideProps & NavigationProps & InjectedCampaignGuideContextProps;

function CampaignGuideView(props: Props) {
  const [countDialog, showCountDialog] = useCountDialog();
  const { componentId, setCampaignServerId } = props;
  const campaignData = useContext(CampaignGuideContext);
  const { typography } = useContext(StyleContext);
  const { campaignId } = campaignData;
  const dispatch = useDispatch();
  const deckActions = useDeckActions();
  const updateCampaignActions = useUpdateCampaignActions();
  const setCampaignName = useCallback((name: string) => {
    dispatch(updateCampaignName(updateCampaignActions, campaignId, name));
    Navigation.mergeOptions(componentId, {
      topBar: {
        title: {
          text: name,
        },
      },
    });
  }, [campaignId, dispatch, updateCampaignActions, componentId]);
  const { dialog, showDialog: showEditNameDialog } = useSimpleTextDialog({
    title: t`Name`,
    value: campaignData.campaign.name,
    onValueChange: setCampaignName,
  });

  useStopAudioOnUnmount();
  useNavigationButtonPressed(({ buttonId }) => {
    if (buttonId === 'edit') {
      showEditNameDialog();
    }
  }, componentId, [showEditNameDialog]);

  const { campaignGuide, campaignState, campaign } = campaignData;
  const processedCampaign = useMemo(() => campaignGuide.processAllScenarios(campaignState), [campaignGuide, campaignState]);
  const [alertDialog, showAlert] = useAlertDialog();
  const footerButtons = useMemo(() => {
    return (
      <View style={space.paddingSideS}>
        <View style={[space.paddingBottomS, space.paddingTopS]}>
          <Text style={[typography.large, typography.center, typography.light]}>
            { `— ${t`Settings`} —` }
          </Text>
        </View>

        <UploadCampaignButton
          componentId={componentId}
          campaignId={campaignId}
          campaign={campaign}
          setCampaignServerId={setCampaignServerId}
          showAlert={showAlert}
          deckActions={deckActions}
        />
        <DeleteCampaignButton
          componentId={componentId}
          campaignId={campaignId}
          campaign={campaign}
          showAlert={showAlert}
        />
      </View>
    );
  }, [componentId, campaign, campaignId, deckActions, typography, setCampaignServerId, showAlert]);
  return (
    <View style={styles.wrapper}>
      <CampaignDetailTab
        componentId={componentId}
        processedCampaign={processedCampaign}
        showAlert={showAlert}
        showCountDialog={showCountDialog}
        footerButtons={footerButtons}
        updateCampaignActions={updateCampaignActions}
      />
      { alertDialog }
      { dialog }
      { countDialog }
    </View>
  );
}

export default withCampaignGuideContext(CampaignGuideView, { rootView: true });

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
});
