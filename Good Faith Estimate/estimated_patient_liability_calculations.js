async function PatientLiabilityCalculations(executionContext) {

    var formContext = executionContext.getFormContext();
    debugger;
    const parentRecordId = Xrm.Page.data.entity.getId().replace("{", "").replace("}", "");
    const subgridRelationshipName = "imperium_PatientEstimate_imperium_Patient"; // Replace with the actual subgrid relationship name
    const apiUrl = `${Xrm.Page.context.getClientUrl()}/api/data/v9.2/imperium_patientestimates(${parentRecordId})/${subgridRelationshipName}`;

    let lineAmounts = {
        sumOfNonVisitLineAmount: 0,
        visitFound: false,
        visitLineAmount: 0,
    }

    const response = await fetch(apiUrl, {
        method: "GET",
        headers: {
            "OData-MaxVersion": "4.0",
            "OData-Version": "4.0",
            "Accept": "application/json",
            "Content-Type": "application/json; charset=utf-8"
        }
    });

    if (response.ok) {
        const data = await response.json();
        debugger;
        // Loop through the retrieved Estimate Code records
        for (const estimateCode of data.value) {
            const serviceCategoryId = estimateCode["_imperium_servicecategory_value"];
            if (serviceCategoryId) {
                // Retrieve Service Category record using Web API
                const serviceCategoryApiUrl = `${Xrm.Page.context.getClientUrl()}/api/data/v9.2/imperium_servicecategories(${serviceCategoryId})`;

                const serviceCategoryResponse = await fetch(serviceCategoryApiUrl, {
                    method: "GET",
                    headers: {
                        "OData-MaxVersion": "4.0",
                        "OData-Version": "4.0",
                        "Accept": "application/json",
                        "Content-Type": "application/json; charset=utf-8"
                    }
                });

                if (serviceCategoryResponse.ok) {

                    const serviceCategoryData = await serviceCategoryResponse.json();
                    debugger;
                    var lineAmount = estimateCode['imperium_test']
                    var categoryName = (serviceCategoryData['imperium_name']).toLowerCase()

                    console.log(lineAmount)
                    console.log(categoryName)

                    // console.log("Line Amount: " + lineAmount);
                    // console.log("Category Name: " + categoryName);

                    if (categoryName.includes('visit')) {
                        lineAmounts.visitLineAmount += lineAmount
                        lineAmounts.visitFound = true
                    }
                    else {
                        lineAmounts.sumOfNonVisitLineAmount += lineAmount
                    }
                    //console.log("Service Category Record:", serviceCategoryData['imperium_name']);
                }
                else {
                    console.error("Error fetching Service Category record:", serviceCategoryResponse.statusText);
                }
            }
        }
        allCalculations(lineAmounts, formContext)
    }
    else {
        console.error("Error:", response.statusText);
    }
}


function allCalculations(lineAmounts, formContext) {

    debugger
    console.log("Calculated values: ")
    console.log(" - Sum of Non-Visit Line Amounts: " + lineAmounts.sumOfNonVisitLineAmount)
    console.log(" - Visit Line Amounts: " + lineAmounts.visitLineAmount)

    let copay = formContext.getAttribute("imperium_officecopay").getValue()
    console.log(" - Copay: " + copay)

    let deductibleMax = formContext.getAttribute("imperium_deductible").getValue()
    let deductibleMet = formContext.getAttribute("imperium_deductibleamountmet").getValue()
    let deductible = deductibleMax - deductibleMet
    console.log(" - Deductible: " + deductible)

    let outOfPocketMax = formContext.getAttribute("imperium_outofpocketmax").getValue()
    let outOfPocketMet = formContext.getAttribute("imperium_outofpocketamountmet").getValue()
    let outOfPocketAvailable = outOfPocketMax - outOfPocketMet
    console.log(" - Out of Pocket Available: " + outOfPocketAvailable)

    let coinsurance = formContext.getAttribute("imperium_coinsurance").getValue() / 100
    console.log(" - Coinsurance: " + coinsurance)

    let actualCopay = 0
    let totalAllowedAmount = 0
    let patientResponsibility = 0
    let estimatedPatientLiability = 0

    //Actual Copay
    if (lineAmounts.visitFound) {

        if (copay > lineAmounts.visitLineAmount) {
            actualCopay = lineAmounts.visitLineAmount
        }
        else if (copay <= lineAmounts.visitLineAmount) {
            actualCopay = copay
        }

    }
    else if (!lineAmounts.visitFound || copay) {
        actualCopay = copay
    }
    console.log(" - Actual Copay: " + actualCopay)

    //Total Allowed Amount
    totalAllowedAmount = actualCopay + lineAmounts.sumOfNonVisitLineAmount
    console.log(" - Total Allowed Amount: " + totalAllowedAmount)

    //Patient Responsibility
    if (deductible > (totalAllowedAmount - actualCopay)) {
        patientResponsibility = totalAllowedAmount
    }
    else if (deductible < (totalAllowedAmount - actualCopay)) {
        patientResponsibility = deductible + (totalAllowedAmount - actualCopay - deductible) * assignOne(coinsurance)
    }
    console.log(" - Patient Responsibility: " + patientResponsibility)

    //Estimated Patient Liability
    if (outOfPocketAvailable > (patientResponsibility + actualCopay)) {
        estimatedPatientLiability = patientResponsibility + actualCopay
    }
    else if (outOfPocketAvailable <= patientResponsibility + actualCopay) {
        estimatedPatientLiability = outOfPocketAvailable
    }
    console.log(" - Estimated Patient Liability: " + estimatedPatientLiability)

    //Setting value of EstimatedPatientLiability
    formContext.getAttribute("imperium_estimatedpatientliability").setValue(estimatedPatientLiability);
    formContext.getAttribute("imperium_allowedamount").setValue(totalAllowedAmount);

}

//Returns one if zero 
function assignOne(value) {
    let toBeReturned

    if (value == 0) {
        toBeReturned = 1
    }
    else {
        toBeReturned = value
    }

    return toBeReturned
}