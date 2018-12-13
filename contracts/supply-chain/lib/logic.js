/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict'
/**
 * Write your transction processor functions here
 */

/**
 * Sample transaction
 * @param {org.catena.SampleTransaction} sampleTransaction
 * @transaction
 */
// async function sampleTransaction(tx) {
//     // Save the old value of the asset.
//     const oldValue = tx.asset.value

//     // Update the asset with the new value.
//     tx.asset.value = tx.newValue

//     // Get the asset registry for the asset.
//     const assetRegistry = await getAssetRegistry('org.catena.SampleAsset')
//     // Update the asset in the asset registry.
//     await assetRegistry.update(tx.asset)

//     // Emit an event for the modified asset.
//     let event = getFactory().newEvent('org.catena', 'SampleEvent')
//     event.asset = tx.asset
//     event.oldValue = oldValue
//     event.newValue = tx.newValue
//     emit(event)
// }

/**
 * Create Supply Agreement transaction
 * @param {org.catena.createSupplyAgreement} tx
 * @transaction
 */
async function createSupplyAgreement(tx) {
    const registry = await getAssetRegistry('org.catena.SupplyAgreement')
    var assets = await registry.getAll()
    var factory = getFactory()

    var NS = 'org.catena'
    var SAID = (assets.length + 1).toString()

    var sr = factory.newResource(NS, 'SupplyAgreement', SAID)

    sr.effectiveDate = tx.effectiveDate
    sr.expiryDate = tx.expiryDate
    sr.priceSetDate = tx.priceSetDate
    sr.requestDatePrior = tx.requestDatePrior
    sr.supplyFailTime = tx.supplyFailTime
    sr.annualBaseQuantity = tx.annualBaseQuantity
    sr.penaltyPercentage = tx.penaltyPercentage
    sr.capPercentage = tx.capPercentage
    sr.siteTable = tx.siteTable
    sr.qualitySpecification = tx.qualitySpecification
    sr.wholesaleListPriceTable = tx.wholesaleListPriceTable
    sr.rebateTable = tx.rebateTable
    sr.customer = tx.customer
    sr.distributor = tx.distributor

    await registry.add(sr)

    let event = factory.newEvent('org.catena', 'SupplyAgreementCreated')
    event.assetType = 'SupplyAgreement'
    event.id = SAID
    event.customer = tx.customer
    event.distributor = tx.distributor
    emit(event)
}
/**
 * Add supply Agreement document url transaction
 * @param {org.catena.addSupplyAgreementDocument} tx
 * @transaction
 */
async function addSupplyAgreementDocument(tx) {
    var NS = 'org.catena.SupplyAgreement'

    const registry = await getAssetRegistry(NS)

    tx.supplyAgreement.supplyAgreementDocumentHash = tx.supplyAgreementDocumentHash
    tx.supplyAgreement.supplyAgreementDocumentUrl = tx.supplyAgreementDocumentUrl
    let event = getFactory().newEvent('org.catena', 'SupplyAgreementDocumentAdded')
    event.assetType = 'SupplyAgreement'
    event.id = tx.supplyAgreement.SAID
    await registry.update(tx.supplyAgreement)
    emit(event)
}

/**
 * Create Supply Request transaction
 * @param {org.catena.createSupplyRequest} tx
 * @transaction
 */
async function createSupplyRequest(tx) {
    var factory = getFactory()
    let request = factory.newConcept('org.catena', 'LateSupplyRequest')
    request.requestDate = tx.requestDate
    request.deliveryDate = tx.deliveryDate

    let checkSupply = factory.newResource(
        'org.catena',
        'checkLateSupply',
        tx.transactionId + ':invokeCicero'
    )
    checkSupply.request = request
    checkSupply.resourceId = tx.supplyAgreement.distributor.UserId
    checkSupply.contractId = tx.supplyAgreement.ciceroContractId
    checkSupply.timestamp = new Date()
    let result = await checkLateSupply(checkSupply)
    if (!result.body.response.supplyRequestValid) {
        throw new Error('Delivery Date does not fall within the request date prior range')
    }
    const registry = await getAssetRegistry('org.catena.SupplyRequest')

    var assets = await registry.getAll()

    var NS = 'org.catena'
    var SRID = (assets.length + 1).toString()

    var sr = factory.newResource(NS, 'SupplyRequest', SRID)

    sr.mabt = tx.mabt
    sr.supplyAgreement = tx.supplyAgreement
    sr.requestDate = tx.requestDate
    sr.volume = tx.volume
    sr.fuelType = tx.fuelType
    sr.volume = tx.volume
    sr.deliveryDate = tx.deliveryDate
    sr.deliveryTime = tx.deliveryTime
    sr.qualitySpecification = tx.qualitySpecification
    sr.customer = tx.customer
    sr.distributor = tx.distributor
    sr.deliveryLocation = tx.deliveryLocation
    await registry.add(sr)

    let event = factory.newEvent('org.catena', 'SupplyRequestCreated')
    event.assetType = 'SupplyRequest'
    event.id = SRID

    emit(event)
}
/**
 * Calls the cicero service to see if the supply is valid
 * @param {org.catena.checkLateSupply} tx
 * @transaction
 */
async function checkLateSupply(tx) {
    let result = await post(
        'https://txtsfvdocf.execute-api.us-west-2.amazonaws.com/Prod/cicero-service/execute',
        tx
    )
    let factory = getFactory()
    let event = factory.newEvent('org.catena', 'LateSupplyCheck')
    event.assetType = 'SupplyRequest'
    event.id = 'None'
    event.result = JSON.stringify(result)
    return result
}
/**
 * Confirm Supply Transaction
 * @param {org.catena.confirmSupply} tx
 * @transaction
 */
async function confirmSupply(tx) {
    var NS = 'org.catena.SupplyRequest'

    const registry = await getAssetRegistry(NS)

    tx.sr.supplyConfirmed = true

    await registry.update(tx.sr)
}

/**
 * Add supply Request Record
 * @param {org.catena.addSupplyRequestRecord} tx
 * @transaction
 */
async function addSupplyRequestRecord(tx) {
    var NS = 'org.catena.SupplyRequest'

    const registry = await getAssetRegistry(NS)

    tx.sr.supplyRequestRecordHash = tx.supplyRequestRecordHash
    tx.sr.supplyRequestRecordUrl = tx.supplyRequestRecordUrl
    await registry.update(tx.sr)
}

/**
 * Add Purchase Order transaction
 * @param {org.catena.addPurchaseOrder} tx
 * @transaction
 */
async function addPurchaseOrder(tx) {
    var NS = 'org.catena.SupplyRequest'

    const registry = await getAssetRegistry(NS)

    tx.sr.purchaseOrderUrl = tx.purchaseOrderUrl
    tx.sr.purchaseOrderHash = tx.purchaseOrderHash
    await registry.update(tx.sr)
}

/**
 * Add distibutor Invoice Transaction
 * @param {org.catena.addDistributorInvoice} tx
 * @transaction
 */
async function addDistributorInvoice(tx) {
    var NS = 'org.catena.SupplyRequest'

    const registry = await getAssetRegistry(NS)

    tx.sr.distributorInvoiceHash = tx.distributorInvoiceHash
    tx.sr.distributorInvoiceUrl = tx.distributorInvoiceUrl

    let event = getFactory().newEvent('org.catena', 'DistributorInvoiceAdded')
    event.assetType = 'SupplyRequest'
    event.id = tx.sr.SRID
    await registry.update(tx.sr)
    emit(event)
}

// /**
//  * Create Uplift Order transaction
//  * @param {org.catena.createUpliftOrder} tx
//  * @transaction
//  */
// async function createUpliftOrder(tx) {
//     const registry = await getAssetRegistry('org.catena.UpliftOrder')

//     var factory = getFactory()

//     var NS = 'org.catena'

//     var assets = await registry.getAll()

//     var UOID = (assets.length + 1).toString()

//     var uplift = factory.newResource(NS, 'UpliftOrder', UOID)

//     uplift.pickupTime = tx.pickupTime
//     uplift.mabd = tx.mabd
//     uplift.volume = tx.volume
//     uplift.origin = tx.origin
//     uplift.destination = tx.destination
//     uplift.qualitySpecification = tx.qualitySpecification
//     uplift.fuelType = tx.fuelType
//     uplift.transportCompany = tx.transportCompany

//     uplift.supplyRequest = tx.supplyRequest
//     uplift.distributor = tx.distributor
//     uplift.manufacturer = tx.manufacturer
//     uplift.transporter = tx.transporter

//     return registry.add(uplift)
// }

/**
 * Add location history
 * @param {org.catena.addLocationHistory} tx
 * @transaction
 */
async function addLocationHistory(tx) {
    var NS = 'org.catena.SupplyRequest'
    var factory = getFactory()

    const registry = await getAssetRegistry(NS)

    const location = factory.newConcept('org.catena', 'Location')
    location.longitude = tx.longitude
    location.latitude = tx.latitude

    if (typeof tx.sr.locationHistory === 'undefined') {
        tx.sr.locationHistory = [location]
    } else {
        tx.sr.locationHistory = [...tx.sr.locationHistory, location]
    }
    let event = factory.newEvent('org.catena', 'LocationAdded')
    event.assetType = 'SupplyRequest'
    event.id = tx.sr.SRID
    await registry.update(tx.sr)
    emit(event)
}

/**
 * Add collection order documnet transaction
 * @param {org.catena.addCollectionOrderDocument} tx
 * @transaction
 */
async function addCollectionOrderDocument(tx) {
    var NS = 'org.catena.UpliftOrder'

    const registry = await getAssetRegistry(NS)

    tx.upliftOrder.collectionOrderDocumentHash = tx.collectionOrderDocumentHash
    tx.upliftOrder.collectionOrderDocumentUrl = tx.collectionOrderDocumentUrl

    await registry.update(tx.upliftOrder)
}

/**
 * add collection receipt document transaction
 * @param {org.catena.addCollectionReceiptDocument} tx
 * @transaction
 */
async function addCollectionReceiptDocument(tx) {
    var NS = 'org.catena.UpliftOrder'

    const registry = await getAssetRegistry(NS)

    tx.upliftOrder.collectionReceiptDocumentHash = tx.collectionReceiptDocumentHash
    tx.upliftOrder.collectionReceiptDocumentUrl = tx.collectionReceiptDocumentUrl

    await registry.update(tx.upliftOrder)
}

/**
 * add manufacturer invoice transaction
 * @param {org.catena.addManufacturerInvoice} tx
 * @transaction
 */
async function addManufacturerInvoice(tx) {
    var NS = 'org.catena.UpliftOrder'

    const registry = await getAssetRegistry(NS)

    tx.upliftOrder.manufacturerInvoiceUrl = tx.manufacturerInvoiceUrl
    tx.upliftOrder.manufacturerInvoiceHash = tx.manufacturerInvoiceHash

    await registry.update(tx.upliftOrder)
}

/**
 * add Transportation Invoice transaction
 * @param {org.catena.addTransportationInvoice} tx
 * @transaction
 */
async function addTransportationInvoice(tx) {
    var NS = 'org.catena.UpliftOrder'

    const registry = await getAssetRegistry(NS)

    tx.upliftOrder.transportationInvoiceUrl = tx.transportationInvoiceUrl
    tx.upliftOrder.transportationInvoiceHash = tx.transportationInvoiceHash

    await registry.update(tx.upliftOrder)
}

/**
 * Confirm collection date transaction
 * @param {org.catena.confirmCollectionDate} tx
 * @transaction
 */
async function confirmCollectionDate(tx) {
    var NS = 'org.catena.UpliftOrder'

    const registry = await getAssetRegistry(NS)

    tx.upliftOrder.collectionDateConfirmed = true

    await registry.update(tx.upliftOrder)
}

/**
 * add Supply Request transaction
 * @param {org.catena.addSupplyRequest} tx
 * @transaction
 */
async function addSupplyRequest(tx) {
    const registry = await getAssetRegistry('org.catena.SupplyAgreement')

    if (typeof tx.supplyAgreement.supplyRequests === 'undefined') {
        tx.supplyAgreement.supplyRequests = [tx.supplyRequest]
    } else {
        tx.supplyAgreement.supplyRequests = [...tx.supplyAgreement.supplyRequests, tx.supplyRequest]
    }
    await registry.update(tx.supplyAgreement)

    let event = getFactory().newEvent('org.catena', 'SupplyRequestAdded')
    event.assetType = 'SupplyAgreement'
    event.id = tx.supplyAgreement.SAID
    event.SRID = tx.supplyRequest.SRID

    emit(event)
}
/**
 * add cicero contract Id to the supply agreement
 * @param {org.catena.addCiceroContract} tx
 * @transaction
 */
async function addCiceroContract(tx) {
    const registry = await getAssetRegistry('org.catena.SupplyAgreement')

    tx.supplyAgreement.ciceroContractId = tx.ciceroContractId
    let returnValue = await registry.update(tx.supplyAgreement)

    let event = getFactory().newEvent('org.catena', 'CiceroContractAdded')
    event.assetType = 'SupplyAgreement'
    event.id = tx.supplyAgreement.SAID
    event.status = 'ACTIVE'
    emit(event)
    return returnValue
}

/**
 * Transaction to complete the supply request, and generate cost
 * @param {org.catena.deliveryCompleted} tx
 * @transaction
 */
async function deliveryCompleted(tx) {
    var factory = getFactory()

    let request = factory.newConcept('org.catena', 'DeliveryRequest')

    request.deliveryLocation = tx.deliveryLocation
    request.deliveryTime = new Date()
    request.mabt = tx.sr.mabt
    request.fuelType = tx.fuelType
    request.volume = tx.volume
    request.qualitySpecification = tx.qualitySpecification

    let check = factory.newResource(
        'org.catena',
        'checkDelivery',
        tx.transactionId + ':invokeCicero'
    )
    check.timestamp = new Date()
    check.resourceId = tx.sr.distributor.UserId
    check.contractId = tx.sr.supplyAgreement.ciceroContractId
    check.request = request

    let result = await checkDelivery(check)
    let response = result.body.response

    if (response.lateDelivery) {
        tx.sr.requestState = 'LATE'
        tx.sr.cost = response.price
        tx.sr.penaltyPercentage = response.penaltyPercentage
        tx.sr.deliveryTime = new Date()
        tx.sr.pricePerLitre = response.pricePerLitre
    } else if (response.supplyFailure) {
        tx.sr.requestState = 'FAILED'
        tx.sr.reasonFailed = 'Supply Failure'
    } else if (response.specificationFailure) {
        tx.sr.requestState = 'FAILED'
        tx.sr.reasonFailed = 'Specification Failure'
        tx.sr.deliveryTime = new Date()
        tx.sr.pricePerLitre = response.pricePerLitre
    } else {
        tx.sr.cost = response.price
        tx.sr.requestState = 'COMPLETED'
        tx.sr.deliveryTime = new Date()
        tx.sr.pricePerLitre = response.pricePerLitre
    }

    const registry = await getAssetRegistry('org.catena.SupplyRequest')
    let event = factory.newEvent('org.catena', 'DeliveryCompleted')
    event.assetType = 'SupplyRequest'
    event.id = tx.sr.SRID
    emit(event)
    return registry.update(tx.sr)
}

/**
 * Posts to cicero to check if valid delivery and generate costs
 * @param {org.catena.checkDelivery} tx
 */
async function checkDelivery(tx) {
    let result = await post(
        'https://txtsfvdocf.execute-api.us-west-2.amazonaws.com/Prod/cicero-service/execute',
        tx
    )
    let event = getFactory().newEvent('org.catena', 'CheckDelivery')
    event.assetType = 'SupplyRequest'
    event.id = 'None'
    emit(event)
    return result
}
/**
 * Query to get asset history
 * @param {org.catena.getAssetHistory} tx
 * @transaction
 */
async function getAssetHistory(tx) {
    const id = tx.assetId

    const nativeKey = getNativeAPI().createCompositeKey('Asset:org.catena.' + tx.assetType, [id])
    console.log(nativeKey)
    const iterator = await getNativeAPI().getHistoryForKey(nativeKey)
    let pay = {}
    let results = []
    let res = { done: false }
    while (!res.done) {
        res = await iterator.next()

        if (res && res.value && res.value.value) {
            // console.log('TxId', res.value.tx_id.toString('utf8'))
            // console.log('Timestamp Seconds', res.value.timestamp.seconds)
            let date = new Date(0)
            date.setUTCSeconds(res.value.timestamp.seconds.low)
            date.setUTCMilliseconds(res.value.timestamp.nanos / 1000000)
            console.log('Seconds date', date)
            // console.log('Timestamp Nano', res.value.timestamp.nanos)
            // console.log('Value', res.value.toString('utf8'))
            let val = res.value.value.toString('utf8')
            // console.log('Value.Value', val)
            if (val.length > 0) {
                let fin = JSON.parse(val)
                fin.tx_id = res.value.tx_id.toString('utf8')
                fin.timestamp = date
                // console.log('Item', fin)
                results.push(fin)
            }
        }
        if (res && res.done) {
            try {
                iterator.close()
            } catch (err) {
                console.log(err)
            }
        }
    }
    pay.results = results
    return JSON.stringify(pay)
}

/**
 * Transaction to sign supply agreement
 * @param {org.catena.signSupplyAgreement} tx
 * @transaction
 */
async function signSupplyAgreement(tx) {
    if (tx.custOrDist === 'Customer') {
        tx.supplyAgreement.customerSigned = true
    } else if (tx.custOrDist === 'Distributor') {
        tx.supplyAgreement.distributorSigned = true
    } else {
        throw new Error('Entity must be Customer or Distributor')
    }

    if (tx.supplyAgreement.customerSigned && tx.supplyAgreement.distributorSigned) {
        tx.supplyAgreement.agreementState = 'ACTIVE'
    }
    const factory = getFactory()
    const registry = await getAssetRegistry('org.catena.SupplyAgreement')

    await registry.update(tx.supplyAgreement)

    let event = factory.newEvent('org.catena', 'SupplyAgreementSigned')
    event.id = tx.supplyAgreement.SAID
    event.assetType = 'SupplyAgreement'
    event.entity = tx.custOrDist
    emit(event)
}
