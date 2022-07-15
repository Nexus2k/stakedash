import React, { useEffect, useState } from 'react'
import { Table, Grid, Button, Label } from 'semantic-ui-react'
import { useSubstrateState } from './substrate-lib'
import eventBus from './EventBus';

export default function Main(props) {
  const { api, keyring } = useSubstrateState()
  const accounts = keyring.getPairs()
  const [balances, setBalances] = useState({})
  const [total_balances, setTotalBalances] = useState({})  

  useEffect(() => {
    const addresses = keyring.getPairs().map(account => account.address)
    let unsubscribeAll = null

    const { unused0, chainDecimals, unused1 } = api.registry;
    console.log(chainDecimals[0])
    console.log(unused0,unused1)

    api.query.system.account
      .multi(addresses, balances => {
        const balancesMap = addresses.reduce(
          (acc, address, index) => ({
            ...acc,
            [address]: (balances[index].data.free / 10.0**chainDecimals[0]).toFixed(2),
          }),
          {}
        )
        setBalances(balancesMap)
      })
      .then(unsub => {
        unsubscribeAll = unsub
      })
      .catch(console.error)

    return () => unsubscribeAll && unsubscribeAll()
  }, [api, keyring, setBalances])

  useEffect(() => {
    const addresses = keyring.getPairs().map(account => account.address)
    let unsubscribeAll = null

    const { unused0, chainDecimals, unused1 } = api.registry;
    console.log(chainDecimals[0])
    console.log(unused0,unused1)

    api.query.system.account
      .multi(addresses, balances => {
        const balancesMap = addresses.reduce(
          (acc, address, index) => ({
            ...acc,
            [address]: (balances[index].data.free / 10.0**chainDecimals[0] + balances[index].data.reserved / 10.0**chainDecimals[0]).toFixed(2),
          }),
          {}
        )
        setTotalBalances(balancesMap)
      })
      .then(unsub => {
        unsubscribeAll = unsub
      })
      .catch(console.error)

    return () => unsubscribeAll && unsubscribeAll()
  }, [api, keyring, setTotalBalances])

  function sendDelegator(delegatorAccount) {
    eventBus.dispatch("changeAccount", delegatorAccount)
  };

  return (
    <Grid.Column>
      <h1>Balances of your accounts</h1>
      {accounts.length === 0 ? (
        <Label basic color="yellow">
          No accounts to be shown
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
                <strong>Free Balance</strong>
              </Table.Cell>
              <Table.Cell width={3}>
                <strong>Total Balance</strong>
              </Table.Cell>
            </Table.Row>
            {accounts.map(account => (
              <Table.Row key={account.address}>
                <Table.Cell width={3} textAlign="right">
                  {account.meta.name}
                </Table.Cell>
                <Table.Cell width={8}>
                  <span style={{ display: 'inline-block', minWidth: '31em' }}>
                    {account.address}
                  </span>
                    <Button
                      basic
                      circular
                      compact
                      size="mini"
                      color="blue"
                      icon="copy outline"
                      onClick={() => sendDelegator(account.address)}
                    />
                </Table.Cell>
                <Table.Cell width={3}>
                  {balances &&
                    balances[account.address] &&
                    balances[account.address]} ZTG
                </Table.Cell>
                <Table.Cell width={3}>
                  {total_balances &&
                    total_balances[account.address] &&
                    total_balances[account.address]} ZTG
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
    </Grid.Column>
  )
}
