import React, { useEffect, useState } from 'react'
import { Grid, Form, Dropdown, Input, Label } from 'semantic-ui-react'
import eventBus from './EventBus'

import { useSubstrateState } from './substrate-lib'
import { TxButton } from './substrate-lib/components'

const argIsOptional = arg => arg.type.toString().startsWith('Option<')

function Main(props) {
  const { api, jsonrpc } = useSubstrateState()
  const [status, setStatus] = useState(null)

  const interxType = 'EXTRINSIC'
  const [palletRPCs, setPalletRPCs] = useState([])
  const [callables, setCallables] = useState([])
  const [paramFields, setParamFields] = useState([])
  const [freeBalance, setFreeBalance] = useState("0")

  const default_collator = "dE1AAA5AxmbcvXLfLKwV8razVm5BxXVNpsgkgKLMB8jC4epbt"

  let initFormState = {
    palletRpc: 'parachainStaking',
    callable: 'delegate',
    inputParams: [],
  }

  const [formState, setFormState] = useState(initFormState)
  const { palletRpc, callable, inputParams } = formState

  // Fill defaults
  useEffect(() => {
    async function getDefaults() {
      let collator = default_collator
      if (inputParams[0] && inputParams[0].value) {
        collator = inputParams[0].value
      }
      let candidateInfo = await api.query.parachainStaking.candidateInfo(collator)
      return [
        {"value":collator},
        {"value":0},
        {"value":candidateInfo.value.delegationCount.toHuman()},
        {"value":0}
      ]
    }
    getDefaults().then(result => {
      initFormState = {
        palletRpc: 'parachainStaking',
        callable: 'delegate',
        inputParams: result,
      }
      setFormState(initFormState)   
    })
  }, [setFormState])

  // handle changes of account address
  useEffect(() => {
    let isMounted = true

    const getChangeAccountEvent = async (data) => {
      let delegatorAccount = data[0]
      let free_balance = data[1] * 10.0**10
      console.log("data from eventbus: " + delegatorAccount)
      let collator = default_collator
      if (inputParams[0] && inputParams[0].value) {
        collator = inputParams[0].value
      }
      let candidateInfo = await api.query.parachainStaking.candidateInfo(collator)
      let delegatorState = await api.query.parachainStaking.delegatorState(delegatorAccount)
      let delegatorCount = "0"
      if (delegatorState && delegatorState.value.delegations) {
        delegatorCount = delegatorState.value.delegations.length.toString()
      }
      initFormState = {
        palletRpc: 'parachainStaking',
        callable: 'delegate',
        inputParams: [
          {"value": collator},
          {"value": free_balance.toString()},
          {"value": candidateInfo.value.delegationCount.toHuman()},
          {"value": delegatorCount}
        ]
      }
      if (isMounted) {
        setFormState(initFormState) 
        setFreeBalance(free_balance)
      }
    }

    eventBus.on("changeAccount", (data) => {
      getChangeAccountEvent(data)
    })

    const getChangeCollatorEvent = async (collatorData) => {
      let collatorAccount = collatorData.owner
      let delegatorCount = "0"
      if (inputParams[3] && inputParams[3].value) {
        delegatorCount = inputParams[3].value
      }
      let free_balance = freeBalance
      if (inputParams[1] && inputParams[1].value) {
        free_balance = inputParams[1].value
      }
      let candidateInfo = await api.query.parachainStaking.candidateInfo(collatorAccount)
      if(collatorData.my_amount == 0) {
        initFormState = {
          palletRpc: 'parachainStaking',
          callable: 'delegate',
          inputParams: [
            {"value": collatorAccount},
            {"value": free_balance.toString()},
            {"value": candidateInfo.value.delegationCount.toHuman()},
            {"value": delegatorCount}
          ]
        }
      } else {
        initFormState = {
          palletRpc: 'parachainStaking',
          callable: 'delegatorBondMore',
          inputParams: [
            {"value": collatorAccount},
            {"value": free_balance.toString()},
          ]
        }
      }
      if (isMounted) {
        setFormState(initFormState) 
      }
    }

    eventBus.on("changeCollator", (data) => {
      getChangeCollatorEvent(data)
    })

    return () => {
      isMounted = false
      eventBus.remove("changeAccount")
      eventBus.remove("changeCollator")
    }
  }, [inputParams, setFormState])

  const updatePalletRPCs = () => {
    if (!api) {
      return
    }
    const apiType = api.tx
    const palletRPCs = Object.keys(apiType)
      .sort()
      .filter(pr => Object.keys(apiType[pr]).length > 0)
      .map(pr => ({ key: pr, value: pr, text: pr }))
    setPalletRPCs(palletRPCs)
  }

  const updateCallables = () => {
    if (!api || palletRpc === '') {
      return
    }
    const callables = Object.keys(api.tx[palletRpc])
      .sort()
      .map(c => ({ key: c, value: c, text: c }))
    setCallables(callables)
  }

  const updateParamFields = () => {
    if (!api || palletRpc === '' || callable === '') {
      setParamFields([])
      return
    }

    let paramFields = []

    const metaArgs = api.tx[palletRpc][callable].meta.args

    if (metaArgs && metaArgs.length > 0) {
      paramFields = metaArgs.map(arg => ({
        name: arg.name.toString(),
        type: arg.type.toString(),
        optional: argIsOptional(arg),
      }))
    }
    setParamFields(paramFields)
  }

  useEffect(updatePalletRPCs, [api, interxType])
  useEffect(updateCallables, [api, interxType, palletRpc])
  useEffect(updateParamFields, [api, interxType, palletRpc, callable, jsonrpc])

  const onPalletCallableParamChange = (_, data) => {
    setFormState(formState => {
      let res
      const { state, value } = data
      if (typeof state === 'object') {
        // Input parameter updated
        const {
          ind,
          paramField: { type },
        } = state
        const inputParams = [...formState.inputParams]
        inputParams[ind] = { type, value }
        res = { ...formState, inputParams }
      } else if (state === 'palletRpc') {
        res = { ...formState, [state]: value, callable: '', inputParams: [] }
      } else if (state === 'callable') {
        res = { ...formState, [state]: value, inputParams: [] }
      }
      return res
    })
  }

  const getOptionalMsg = interxType =>
    interxType === 'RPC'
      ? 'Optional Parameter'
      : 'Leaving this field as blank will submit a NONE value'

  return (
    <Grid.Column width={8}>
      <h1>Stake/Delegate</h1>
      <h3>Amount is free funds -0.5 ZTG, with 10 extra zeroes</h3>
      <Form>
        <Form.Field>
          <Dropdown
            placeholder="Pallets / RPC"
            fluid
            label="Pallet / RPC"
            onChange={onPalletCallableParamChange}
            search
            selection
            state="palletRpc"
            value={palletRpc}
            options={palletRPCs}
          />
        </Form.Field>
        <Form.Field>
          <Dropdown
            placeholder="Callables"
            fluid
            label="Callable"
            onChange={onPalletCallableParamChange}
            search
            selection
            state="callable"
            value={callable}
            options={callables}
          />
        </Form.Field>
        {paramFields.map((paramField, ind) => (
          <Form.Field key={`${paramField.name}-${paramField.type}`}>
            <Input
              placeholder={paramField.type}
              fluid
              type="text"
              label={paramField.name}
              state={{ ind, paramField }}
              value={inputParams[ind] ? inputParams[ind].value : ''}
              onChange={onPalletCallableParamChange}
            />
            {paramField.optional ? (
              <Label
                basic
                pointing
                color="teal"
                content={getOptionalMsg(interxType)}
              />
            ) : null}
          </Form.Field>
        ))}
        <Form.Field style={{ textAlign: 'center' }}>
          <TxButton label="Submit & Sign" type="SIGNED-TX" color="blue"
            setStatus={setStatus}
            attrs={{
              interxType,
              palletRpc,
              callable,
              inputParams,
              paramFields,
            }}
          />
        </Form.Field>
        <div style={{ overflowWrap: 'break-word' }}>{status}</div>
      </Form>
    </Grid.Column>
  )
}

export default function Interactor(props) {
  const { api } = useSubstrateState()
  return api.tx ? <Main {...props} /> : null
}
