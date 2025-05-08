// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0
import { useSuiClientContext, useSuiClientQuery } from '@mysten/dapp-kit';
import { SuiParsedData } from '@mysten/sui.js/client';
import { isValidSuiObjectId } from '@mysten/sui.js/utils';
import { MagnifyingGlassIcon } from '@radix-ui/react-icons';
import { TextField, Button } from '@radix-ui/themes';
import { useState } from 'react';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { useTransactionExecution } from '../hooks/useTransactionExecution';

import { InvalidObject } from '../components/InvalidObject';
import { ProposedUpgradeOverview } from '../components/ProposedUpgradeOverview';
import {
	convertObjectToProposedUpgrade,
	convertObjectToQuorumUpgradeObject,
} from '../helpers/utils';
import { UPGRADE_MODULES, UPGRADE_DEPENDENCIES, QUORUM_UPGRADE_CAP_ID, QUORUM_UPGRADE_PACKAGE_ID, PACKAGE_ID } from './config';
// Constants from transactions.ts


export function CommitUpgrade() {
	const { network } = useSuiClientContext();
	const [proposalObjectId, setProposalObjectId] = useState<string>('');
	const { executeTransaction } = useTransactionExecution();

	const proposalData = useSuiClientQuery(
		'getObject',
		{
			id: proposalObjectId,
			options: {
				showContent: true,
			},
		},
		{
			enabled: !!(proposalObjectId && isValidSuiObjectId(proposalObjectId)),
			select(data) {
				if (!data.data) return undefined;
				return convertObjectToProposedUpgrade(data.data.content as SuiParsedData, network);
			},
		},
	);

	const quorumUpgradeObject = useSuiClientQuery(
		'getObject',
		{
			id: proposalData.data?.upgradeCapId!,
			options: {
				showContent: true,
			},
		},
		{
			enabled: !!proposalData.data?.upgradeCapId,
			select(data) {
				if (!data.data) return undefined;
				return convertObjectToQuorumUpgradeObject(data.data.content as SuiParsedData, network);
			},
		},
	);

	const refreshData = () => {
		proposalData.refetch();
		quorumUpgradeObject.refetch();
	};

	const handleExecuteUpgrade = async () => {
		if (!proposalObjectId) return;

		const txb = new TransactionBlock();

		// Authorize and commit the upgrade
		const ticket = txb.moveCall({
			target: `${QUORUM_UPGRADE_PACKAGE_ID}::quorum_upgrade_policy::authorize_upgrade`,
			arguments: [
				txb.object(QUORUM_UPGRADE_CAP_ID),
				txb.object(proposalObjectId),
			]
		});

		const receipt = txb.upgrade({
			modules: UPGRADE_MODULES,
			dependencies: UPGRADE_DEPENDENCIES,
			packageId: PACKAGE_ID,
			ticket,
		});

		txb.moveCall({
			target: `${QUORUM_UPGRADE_PACKAGE_ID}::quorum_upgrade_policy::commit_upgrade`,
			arguments: [
				txb.object(QUORUM_UPGRADE_CAP_ID),
				receipt
			]
		});

		await executeTransaction(txb);
		refreshData();
	};

	return (
		<div>
			<TextField.Root size="3">
				<TextField.Slot>
					<MagnifyingGlassIcon height="16" width="16" />
				</TextField.Slot>
				<TextField.Input
					value={proposalObjectId}
					onChange={(e) => setProposalObjectId(e.target.value)}
					placeholder="Type in the UpgradedProposal ID..."
					disabled={!!proposalData.data}
				/>
			</TextField.Root>

			{!!proposalObjectId && !proposalData.data && !proposalData.isLoading && (
				<div className="mt-3">
					<InvalidObject />
				</div>
			)}

			{proposalData.data && quorumUpgradeObject.data && (
				<>
					<ProposedUpgradeOverview
						proposedUpgrade={proposalData.data}
						quorumUpgradeObject={quorumUpgradeObject.data}
						refresh={refreshData}
					/>
					<div className="mt-4">
						<Button onClick={handleExecuteUpgrade} size="3">
							Execute Upgrade
						</Button>
					</div>
				</>
			)}
		</div>
	);
}
