import React, { useEffect, useState } from 'react'
import { Table, Grid, Button, Label } from 'semantic-ui-react'
import { useSubstrateState } from './substrate-lib'
import { hexToString } from '@polkadot/util';
import eventBus from './EventBus';

export default function Main(props) {
  const { api } = useSubstrateState()
  const [collators, setCollators] = useState([])
  const [self_stakes, setMyStake] = useState([])
  const [num_collators, setNumCollators] = useState(0)

  const { unused0, chainDecimals, unused1 } = api.registry;
  console.log(chainDecimals)
  console.log(unused0,unused1)

  useEffect(() => {
    let unsubscribeAll = null

    api.query.parachainStaking.totalSelected(
      num_candidates => {
        setNumCollators(num_candidates)
    }
    ).then(unsub => {
      unsubscribeAll = unsub
    })
    .catch(console.error)

    return () => unsubscribeAll && unsubscribeAll()
  }, [api, setNumCollators])

  // handle changes of account address
  useEffect(() => {
    let isMounted = true

    const getChangeAccountEvent = async (data) => {
      let delegatorAccount = data[0]
      console.log("data from eventbus: " + delegatorAccount)
      let delegatorState = await api.query.parachainStaking.delegatorState(delegatorAccount)
      if (isMounted && delegatorState) {
        setMyStake(delegatorState.value.delegations) 
      }
    }

    eventBus.on("changeAccount", (data) => {
      getChangeAccountEvent(data)
    })

    return () => {
      isMounted = false
      eventBus.remove("changeAccount")
    }
  }, [setMyStake])

  useEffect(() => {
    let unsubscribeAll = null

    api.query.parachainStaking.candidatePool(
      async candidates => {
      console.log("# of collators: " + candidates.length)
      const formatted_candidates = await Promise.all(candidates.map(async (candidate) => {
        const id = await api.query.identity.identityOf(candidate.owner.toHuman())
        let display_name = ""
        try {
          display_name = hexToString(id.value.info.display.asRaw.toHex())
        } catch (error) {
          console.log(error)
          try {
            const sup_addr = await api.query.identity.superOf(candidate.owner)
            let sub_name = sup_addr.value && hexToString(sup_addr.value[1].asRaw.toHex())
            const sup_id = await api.query.identity.identityOf(sup_addr.value[0])
            display_name = hexToString(sup_id.value.info.display.asRaw.toHex()) + "/" + sub_name
          } catch (error) {
            console.log(error)
          }
        }
        console.log("Self stake: "+self_stakes)
        let my_amount = 0
        if(self_stakes && self_stakes.filter(delegation => delegation.owner.toHuman() === candidate.owner.toHuman())[0]) {
          my_amount = self_stakes.filter(delegation => delegation.owner.toHuman() === candidate.owner.toHuman())[0].amount / 10**chainDecimals[0]
        }
        console.log("My amount: "+my_amount)
        return {
          "name": display_name,
          "owner": candidate.owner.toHuman(),
          "amount": (candidate.amount / 10**chainDecimals[0]),
          "my_amount": my_amount
        }
      }))
      setCollators(formatted_candidates)
    }
    ).then(unsub => {
      unsubscribeAll = unsub
    })
    .catch(console.error)

    return () => unsubscribeAll && unsubscribeAll()
  }, [api, self_stakes, setCollators])

  function compare( a, b ) {
    if ( a["amount"] > b["amount"] ){
      return -1;
    }
    if ( a["amount"] < b["amount"] ){
      return 1;
    }
    return 0;
  }

  function sendCollator(collatorAccount) {
    eventBus.dispatch("changeCollator", collatorAccount)
  };

  return (
    <Grid.Column>
      <h1>Collators</h1>
      {collators.length === 0 ? (
        <Label basic color="yellow">
          No collators to be shown
        </Label>
      ) : (
        <Table celled striped size="small">
          <Table.Body>
            <Table.Row>
            <Table.Cell width={3} textAlign="right">
                <strong>Name</strong>
              </Table.Cell>
              <Table.Cell width={8}>
                <strong>Address</strong>
              </Table.Cell>
              <Table.Cell width={3}>
                <strong>Total Balance</strong>
              </Table.Cell>
              <Table.Cell width={3}>
                <strong>Your stake</strong>
              </Table.Cell>
            </Table.Row>
            {Array.from(collators).sort(compare).slice(0, num_collators).map(collator => (
            <Table.Row key={collator["owner"]}>
              <Table.Cell width={3} textAlign="right">
                  {collator["name"]}
              </Table.Cell>
              <Table.Cell width={8}>
              <span style={{ display: 'inline-block', minWidth: '35em' }}>
                {collator["owner"]}
                </span>
                  <Button
                    basic
                    circular
                    compact
                    size="mini"
                    color="blue"
                    icon="copy outline"
                    onClick={() => sendCollator({"owner":collator["owner"],"my_amount":collator["my_amount"]})}
                  />
              </Table.Cell>
              <Table.Cell width={3}>
                {collator["amount"].toFixed(2)} ZTG
              </Table.Cell>
              <Table.Cell width={3}>
                {collator["my_amount"].toFixed(2)} ZTG
              </Table.Cell>
            </Table.Row>
            ))}
            <Table.Row>
              <Table.Cell textAlign="center" colSpan="4">
                <strong>Outside of active collator set</strong>
              </Table.Cell>
            </Table.Row>
            {Array.from(collators).sort(compare).slice(num_collators).map(collator => (
            <Table.Row key={collator["owner"]}>
              <Table.Cell width={3} textAlign="right">
                  {collator["name"]}
              </Table.Cell>
              <Table.Cell width={8}>
                <span style={{ display: 'inline-block', minWidth: '35em' }}>
                {collator["owner"]}
                </span>
                  <Button
                    basic
                    circular
                    compact
                    size="mini"
                    color="blue"
                    icon="copy outline"
                    onClick={() => sendCollator({"owner":collator["owner"],"my_amount":collator["my_amount"]})}
                  />
              </Table.Cell>
              <Table.Cell width={3}>
                {collator["amount"].toFixed(2)} ZTG
              </Table.Cell>
              <Table.Cell width={3}>
                {collator["my_amount"].toFixed(2)} ZTG
              </Table.Cell>
            </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
    </Grid.Column>
  )
}
